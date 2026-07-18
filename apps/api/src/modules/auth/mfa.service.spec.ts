jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MfaService } from './mfa.service';

describe('MfaService acceptance flows', () => {
  const originalKey = process.env.VAULT_ENCRYPTION_KEY;
  const originalRedis = process.env.REDIS_URL;

  let prisma: any;
  let authService: any;
  let service: MfaService;
  let storedUser: any;

  beforeAll(() => {
    process.env.VAULT_ENCRYPTION_KEY = 'test-only-vault-encryption-key-at-least-32-characters';
    delete process.env.REDIS_URL;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalKey;
    if (originalRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedis;
  });

  beforeEach(() => {
    storedUser = {
      id: 'user-1',
      email: 'admin@example.com',
      tenantId: 'tenant-1',
      mfaEnabled: false,
      mfaSecret: null,
    };

    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === storedUser.id ? { ...storedUser } : null,
        ),
        update: jest.fn(async ({ where, data }) => {
          if (where.id !== storedUser.id) throw new Error('missing user');
          Object.assign(storedUser, data);
          return { ...storedUser };
        }),
      },
      tenant: {
        findUnique: jest.fn(async () => ({ settings: {} })),
      },
    };

    authService = {
      issueTokens: jest.fn(async () => ({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })),
    };

    service = new MfaService(
      prisma,
      new ConfigService({ MFA_ISSUER: 'QS Assets Test' }),
      authService,
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('enrolls with an encrypted secret and enables MFA only after a valid TOTP', async () => {
    const enrollment = await service.enroll('user-1');
    expect(enrollment.secret).toMatch(/^[A-Z2-7]+$/);
    expect(enrollment.otpauthUrl).toContain('otpauth://totp/');
    expect(enrollment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(storedUser.mfaEnabled).toBe(false);
    expect(storedUser.mfaSecret).toContain(':');
    expect(storedUser.mfaSecret).not.toBe(enrollment.secret);

    const OTPAuth = require('otpauth');
    const code = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(enrollment.secret),
    }).generate();

    await expect(service.verifyEnroll('user-1', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.verifyEnroll('user-1', code)).resolves.toEqual({ mfaEnabled: true });
    expect(storedUser.mfaEnabled).toBe(true);
  });

  it('issues a one-time MFA challenge and exchanges a valid code for tokens', async () => {
    const enrollment = await service.enroll('user-1');
    const OTPAuth = require('otpauth');
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(enrollment.secret),
    });
    await service.verifyEnroll('user-1', totp.generate());

    const challenge = await service.beginChallenge(storedUser);
    expect(challenge).toMatchObject({ mfaRequired: true });
    expect((challenge as any).mfaToken).toHaveLength(48);

    const tokens = await service.completeChallenge(
      (challenge as any).mfaToken,
      totp.generate(),
      '127.0.0.1',
      'jest',
    );
    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(authService.issueTokens).toHaveBeenCalled();

    await expect(
      service.completeChallenge((challenge as any).mfaToken, totp.generate()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks login when tenant enforces MFA but the user has not enrolled', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { mfaEnforced: true } });
    const result = await service.beginChallenge({
      id: 'user-1',
      tenantId: 'tenant-1',
      mfaEnabled: false,
    });
    expect(result).toMatchObject({
      mfaRequired: true,
      mfaEnrollmentRequired: true,
    });
  });

  it('disables MFA only with a valid current TOTP code', async () => {
    const enrollment = await service.enroll('user-1');
    const OTPAuth = require('otpauth');
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(enrollment.secret),
    });
    await service.verifyEnroll('user-1', totp.generate());

    await expect(service.disable('user-1', '111111')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.disable('user-1', totp.generate())).resolves.toEqual({
      mfaEnabled: false,
    });
    expect(storedUser.mfaEnabled).toBe(false);
    expect(storedUser.mfaSecret).toBeNull();
  });

  it('rejects re-enrollment while MFA is already enabled', async () => {
    storedUser.mfaEnabled = true;
    storedUser.mfaSecret = 'already';
    await expect(service.enroll('user-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
