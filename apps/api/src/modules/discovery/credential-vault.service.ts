import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';
import { isVaultValue, openVaultValue, sealVaultValue } from '../../common/security/vault-crypto';

const ALGORITHM = 'aes-256-cbc';

function getVaultKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      const logger = new Logger('CredentialVaultService');
      logger.error('FATAL: VAULT_ENCRYPTION_KEY environment variable is not set. Refusing to start in production with an insecure default.');
      process.exit(1);
    }
    const logger = new Logger('CredentialVaultService');
    logger.warn('⚠️  WARNING: VAULT_ENCRYPTION_KEY is not set — using insecure default. DO NOT run this configuration in production!');
    return 'assetcommand-default-vault-key-32!';
  }
  return key;
}

@Injectable()
export class CredentialVaultService {
  constructor(private prisma: PrismaService) {}

  private publicCredential<T extends { encryptedData?: string }>(credential: T) {
    const { encryptedData, ...safe } = credential;
    return { ...safe, hasCredentials: !!encryptedData };
  }

  private encrypt(text: string): string {
    const vaultKey = getVaultKey();
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(vaultKey, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Format: salt:iv:ciphertext (random salt per credential)
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const vaultKey = getVaultKey();
    const parts = encryptedText.split(':');

    let salt: Buffer;
    let iv: Buffer;
    let encrypted: string;

    if (parts.length === 3) {
      // New format: salt:iv:ciphertext
      salt = Buffer.from(parts[0], 'hex');
      iv = Buffer.from(parts[1], 'hex');
      encrypted = parts[2];
    } else {
      // Legacy format: iv:ciphertext (hardcoded 'salt')
      salt = Buffer.from('salt');
      iv = Buffer.from(parts[0], 'hex');
      encrypted = parts[1];
    }

    const key = crypto.scryptSync(vaultKey, salt, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async findAll(tenantId: string) {
    const creds = await this.prisma.scanCredential.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Never expose the encrypted data in list view
    return creds.map(c => ({
      ...c,
      encryptedData: undefined,
      hasCredentials: !!c.encryptedData,
    }));
  }

  async create(tenantId: string, userId: string, data: {
    name: string; type: string; credentials: Record<string, any>; scope?: any;
  }) {
    const encryptedData = sealVaultValue(JSON.stringify(data.credentials));
    const credential = await this.prisma.scanCredential.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        encryptedData,
        scope: data.scope || {},
        createdById: userId,
      },
    });
    return this.publicCredential(credential);
  }

  async update(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Credential not found');

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.scope) updateData.scope = data.scope;
    if (data.credentials) {
      updateData.encryptedData = sealVaultValue(JSON.stringify(data.credentials));
    }

    const credential = await this.prisma.scanCredential.update({ where: { id }, data: updateData });
    return this.publicCredential(credential);
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Credential not found');
    await this.prisma.scanCredential.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Used internally by scan engine to get decrypted credentials */
  async getDecrypted(id: string, tenantId: string): Promise<Record<string, any> | null> {
    const cred = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!cred) return null;
    await this.prisma.scanCredential.update({ where: { id }, data: { lastUsedAt: new Date() } });
    const plaintext = isVaultValue(cred.encryptedData)
      ? openVaultValue(cred.encryptedData)
      : this.decrypt(cred.encryptedData);
    return JSON.parse(plaintext);
  }
}
