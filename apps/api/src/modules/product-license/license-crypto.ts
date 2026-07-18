import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Ed25519 signing for QS Assets product entitlements.
 *
 * Production SaaS: set LICENSE_PRIVATE_KEY (PKCS8 PEM) + LICENSE_PUBLIC_KEY (SPKI PEM).
 * On-prem: LICENSE_PUBLIC_KEY only (must match issuer).
 * Dev fallback: ephemeral keypair logged once (licenses not portable across restarts).
 */

export interface EntitlementClaims {
  licenseKey: string;
  customerName: string;
  plan: 'ENTERPRISE' | 'ON_PREMISE';
  maxAssets: number;
  maxUsers: number;
  allowedModules: string[];
  expiresAt: string; // ISO
  iss: string;
  fingerprint?: string | null;
  installId?: string;
  activationNonce?: string;
  iat?: string;
}

export interface LicenseChallenge {
  version: 1;
  installId: string;
  fingerprint: string;
  nonce: string;
  expiresAt: string;
}

export interface SignedLicenseFile {
  version: 1;
  payload: EntitlementClaims;
  signature: string; // base64
}

const log = new Logger('LicenseCrypto');

let cachedPrivateKey: ReturnType<typeof createPrivateKey> | null | undefined;
let cachedPublicKey: ReturnType<typeof createPublicKey> | null | undefined;
let ephemeralLogged = false;

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function getOrCreateDevKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  if (!ephemeralLogged) {
    log.warn(
      'LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY not set — using ephemeral Ed25519 keypair (dev only). Issued licenses will not verify after restart.',
    );
    ephemeralLogged = true;
  }
  return { publicKey, privateKey };
}

export function getPrivateKey() {
  if (cachedPrivateKey !== undefined) return cachedPrivateKey;
  const pem = process.env.LICENSE_PRIVATE_KEY?.trim();
  if (pem) {
    cachedPrivateKey = createPrivateKey(normalizePem(pem));
    return cachedPrivateKey;
  }
  if ((process.env.NODE_ENV || 'development') === 'production' && (process.env.DEPLOYMENT_MODE || 'saas') === 'saas') {
    log.warn('LICENSE_PRIVATE_KEY missing in production SaaS — license issuance will fail until configured');
    cachedPrivateKey = null;
    return null;
  }
  const pair = getOrCreateDevKeyPair();
  cachedPrivateKey = pair.privateKey;
  cachedPublicKey = pair.publicKey;
  return cachedPrivateKey;
}

export function getPublicKey() {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  const pem = process.env.LICENSE_PUBLIC_KEY?.trim();
  if (pem) {
    cachedPublicKey = createPublicKey(normalizePem(pem));
    return cachedPublicKey;
  }
  // Ensure private path may have created ephemeral pair
  getPrivateKey();
  if (cachedPublicKey) return cachedPublicKey;
  const pair = getOrCreateDevKeyPair();
  cachedPublicKey = pair.publicKey;
  cachedPrivateKey = pair.privateKey;
  return cachedPublicKey;
}

function canonicalPayload(claims: EntitlementClaims): Buffer {
  const ordered: EntitlementClaims = {
    licenseKey: claims.licenseKey,
    customerName: claims.customerName,
    plan: claims.plan,
    maxAssets: claims.maxAssets,
    maxUsers: claims.maxUsers,
    allowedModules: [...(claims.allowedModules || [])].sort(),
    expiresAt: claims.expiresAt,
    iss: claims.iss || 'neurq',
    fingerprint: claims.fingerprint ?? null,
    installId: claims.installId,
    activationNonce: claims.activationNonce,
    iat: claims.iat,
  };
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

export function signEntitlement(claims: EntitlementClaims): SignedLicenseFile {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('LICENSE_PRIVATE_KEY is required to sign entitlements');
  }
  const withIat: EntitlementClaims = {
    ...claims,
    iat: claims.iat || new Date().toISOString(),
    iss: claims.iss || 'neurq',
  };
  const data = canonicalPayload(withIat);
  const signature = sign(null, data, privateKey).toString('base64');
  return { version: 1, payload: withIat, signature };
}

export function verifySignedLicense(file: SignedLicenseFile): EntitlementClaims {
  if (!file || file.version !== 1 || !file.payload || !file.signature) {
    throw new Error('Invalid license file format');
  }
  const publicKey = getPublicKey();
  if (!publicKey) throw new Error('LICENSE_PUBLIC_KEY is required to verify entitlements');
  const data = canonicalPayload(file.payload);
  const ok = verify(null, data, publicKey, Buffer.from(file.signature, 'base64'));
  if (!ok) throw new Error('License signature verification failed');
  return file.payload;
}

export function encodeLicenseBlob(file: SignedLicenseFile): string {
  return Buffer.from(JSON.stringify(file), 'utf8').toString('base64');
}

export function decodeLicenseBlob(blob: string): SignedLicenseFile {
  const json = Buffer.from(blob.trim(), 'base64').toString('utf8');
  return JSON.parse(json) as SignedLicenseFile;
}

export function parseLicenseInput(raw: string): SignedLicenseFile {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as SignedLicenseFile;
  }
  return decodeLicenseBlob(trimmed);
}

export function encodeLicenseChallenge(challenge: LicenseChallenge): string {
  return Buffer.from(JSON.stringify(challenge), 'utf8').toString('base64');
}

export function parseLicenseChallenge(raw: string | LicenseChallenge): LicenseChallenge {
  const parsed =
    typeof raw === 'string'
      ? JSON.parse(
          raw.trim().startsWith('{')
            ? raw.trim()
            : Buffer.from(raw.trim(), 'base64').toString('utf8'),
        )
      : raw;
  if (
    !parsed ||
    parsed.version !== 1 ||
    !parsed.installId ||
    !parsed.fingerprint ||
    !parsed.nonce ||
    !parsed.expiresAt
  ) {
    throw new Error('Invalid license challenge');
  }
  return parsed as LicenseChallenge;
}

export function generateLicenseKey(): string {
  const seg = () =>
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join('');
  return `QS-${seg()}-${seg()}-${seg()}-${seg()}`;
}
