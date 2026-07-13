import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Inject,
  forwardRef,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthService } from './auth.service';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import IORedis from 'ioredis';

const ALGORITHM = 'aes-256-cbc';
const MFA_CHALLENGE_PREFIX = 'mfa:challenge:';
const MFA_TTL_SEC = 5 * 60;

function getVaultKey(): Buffer {
  const raw =
    process.env.VAULT_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : 'assetcommand-default-vault-key-32!');
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY is required');
  return crypto.createHash('sha256').update(raw).digest();
}

@Injectable()
export class MfaService implements OnModuleDestroy {
  private readonly logger = new Logger(MfaService.name);
  /** In-memory fallback when Redis is unavailable (single-node only). */
  private readonly challenges = new Map<string, { userId: string; expiresAt: number }>();
  private redis: IORedis | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        this.redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
        this.redis.connect().catch((err) => {
          this.logger.warn(`MFA Redis connect failed: ${err.message} — using in-memory challenges`);
          this.redis = null;
        });
      } catch (err: any) {
        this.logger.warn(`MFA Redis init failed: ${err?.message}`);
        this.redis = null;
      }
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getVaultKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getVaultKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getOtpauth() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('otpauth');
    } catch {
      throw new BadRequestException('otpauth package is not installed');
    }
  }

  /**
   * Start MFA enrollment — returns otpauth URI + QR data URL.
   * Secret stored encrypted but mfaEnabled stays false until verify-enroll.
   */
  async enroll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled. Disable first to re-enroll.');
    }

    const OTPAuth = this.getOtpauth();
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: this.configService.get('MFA_ISSUER') || 'QS Assets',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.encrypt(secret.base32), mfaEnabled: false },
    });

    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri);

    return {
      secret: secret.base32,
      otpauthUrl: uri,
      qrDataUrl,
      message: 'Scan the QR code, then call POST /auth/mfa/verify-enroll with a TOTP code.',
    };
  }

  async verifyEnroll(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('Call enroll first');
    const ok = this.verifyCode(user.mfaSecret, code);
    if (!ok) throw new UnauthorizedException('Invalid TOTP code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    return { mfaEnabled: true };
  }

  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }
    if (!this.verifyCode(user.mfaSecret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: !!user?.mfaEnabled };
  }

  /** Tenant settings.mfaEnforced — require MFA enrollment before issuing JWTs. */
  async isTenantMfaEnforced(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as any) || {};
    return settings.mfaEnforced === true || settings.mfaRequired === true;
  }

  /**
   * After password validation — if MFA enabled, return challenge token instead of JWTs.
   * If tenant enforces MFA and user has not enrolled, block login.
   */
  async beginChallenge(user: any): Promise<
    | { mfaRequired: true; mfaToken: string; mfaChallengeToken: string }
    | { mfaRequired: false }
    | { mfaRequired: true; mfaEnrollmentRequired: true; message: string }
  > {
    if (!user.mfaEnabled) {
      const enforced = user.tenantId ? await this.isTenantMfaEnforced(user.tenantId) : false;
      if (enforced) {
        return {
          mfaRequired: true,
          mfaEnrollmentRequired: true,
          message: 'MFA is required for this organization. Enroll via Settings after admin bootstrap, or contact your admin.',
        };
      }
      return { mfaRequired: false };
    }
    const mfaToken = crypto.randomBytes(24).toString('hex');
    await this.storeChallenge(mfaToken, user.id);
    return { mfaRequired: true, mfaToken, mfaChallengeToken: mfaToken };
  }

  private async storeChallenge(token: string, userId: string) {
    if (this.redis) {
      try {
        await this.redis.setex(
          `${MFA_CHALLENGE_PREFIX}${token}`,
          MFA_TTL_SEC,
          JSON.stringify({ userId, expiresAt: Date.now() + MFA_TTL_SEC * 1000 }),
        );
        return;
      } catch (err: any) {
        this.logger.warn(`MFA Redis store failed: ${err.message}`);
      }
    }
    this.challenges.set(token, {
      userId,
      expiresAt: Date.now() + MFA_TTL_SEC * 1000,
    });
  }

  private async takeChallenge(token: string): Promise<{ userId: string; expiresAt: number } | null> {
    if (this.redis) {
      try {
        const key = `${MFA_CHALLENGE_PREFIX}${token}`;
        const raw = await this.redis.get(key);
        if (raw) {
          await this.redis.del(key);
          return JSON.parse(raw);
        }
      } catch (err: any) {
        this.logger.warn(`MFA Redis get failed: ${err.message}`);
      }
    }
    const pending = this.challenges.get(token);
    this.challenges.delete(token);
    return pending || null;
  }

  async completeChallenge(
    mfaToken: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ) {
    const pending = await this.takeChallenge(mfaToken);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }
    const user = await this.prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not configured');
    }
    if (!this.verifyCode(user.mfaSecret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    return this.authService.issueTokens(user, ip, userAgent);
  }

  /** Alias for createChallengeToken naming used elsewhere. */
  async createChallengeToken(user: any) {
    return this.beginChallenge(user);
  }

  private verifyCode(encryptedSecret: string, code: string): boolean {
    if (!code || !/^\d{6}$/.test(String(code).trim())) return false;
    const OTPAuth = this.getOtpauth();
    const base32 = this.decrypt(encryptedSecret);
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32),
    });
    const delta = totp.validate({ token: String(code).trim(), window: 1 });
    return delta !== null;
  }
}
