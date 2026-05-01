import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';

const VAULT_KEY = process.env.VAULT_ENCRYPTION_KEY || 'assetcommand-default-vault-key-32!'; // 32 chars for AES-256
const ALGORITHM = 'aes-256-cbc';

@Injectable()
export class CredentialVaultService {
  constructor(private prisma: PrismaService) {}

  private encrypt(text: string): string {
    const key = crypto.scryptSync(VAULT_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const key = crypto.scryptSync(VAULT_KEY, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
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
    const encryptedData = this.encrypt(JSON.stringify(data.credentials));
    return this.prisma.scanCredential.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        encryptedData,
        scope: data.scope || {},
        createdById: userId,
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Credential not found');

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.scope) updateData.scope = data.scope;
    if (data.credentials) {
      updateData.encryptedData = this.encrypt(JSON.stringify(data.credentials));
    }

    return this.prisma.scanCredential.update({ where: { id }, data: updateData });
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Credential not found');
    return this.prisma.scanCredential.delete({ where: { id } });
  }

  /** Used internally by scan engine to get decrypted credentials */
  async getDecrypted(id: string, tenantId: string): Promise<Record<string, any> | null> {
    const cred = await this.prisma.scanCredential.findFirst({ where: { id, tenantId } });
    if (!cred) return null;
    await this.prisma.scanCredential.update({ where: { id }, data: { lastUsedAt: new Date() } });
    return JSON.parse(this.decrypt(cred.encryptedData));
  }
}
