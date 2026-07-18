import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'vault:v1';

function key(): Buffer {
  const configured = process.env.VAULT_ENCRYPTION_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VAULT_ENCRYPTION_KEY is required to store credentials');
    }
    return createHash('sha256').update('development-only-vault-key').digest();
  }
  if (configured.length < 32) {
    throw new Error('VAULT_ENCRYPTION_KEY must be at least 32 characters');
  }
  return createHash('sha256').update(configured).digest();
}

export function isVaultValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function sealVaultValue(plaintext: string): string {
  if (isVaultValue(plaintext)) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function openVaultValue(value: string): string {
  if (!isVaultValue(value)) return value;
  const [, , ivEncoded, tagEncoded, ciphertextEncoded] = value.split(':');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid vault value');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(ivEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
