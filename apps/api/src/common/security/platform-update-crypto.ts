import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'crypto';

export interface PlatformReleaseInput {
  version: string;
  releaseDate: string;
  images: Record<string, string>;
}

export interface PlatformUpdateManifest extends PlatformReleaseInput {
  checksum: string;
  signature: {
    algorithm: 'Ed25519';
    encoding: 'base64';
    value: string;
    publicKeyFingerprint: string;
  };
}

const IMMUTABLE_IMAGE_PATTERN =
  /^(?:[A-Za-z0-9._/:~-]+@)?sha256:[a-f0-9]{64}$/i;

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function normalizedRelease(input: PlatformReleaseInput): PlatformReleaseInput {
  return {
    version: input.version.trim(),
    releaseDate: input.releaseDate,
    images: Object.fromEntries(
      Object.entries(input.images).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

export function platformManifestPayload(input: PlatformReleaseInput): Buffer {
  return Buffer.from(JSON.stringify(normalizedRelease(input)), 'utf8');
}

export function platformManifestChecksum(input: PlatformReleaseInput): string {
  return `sha256:${createHash('sha256').update(platformManifestPayload(input)).digest('hex')}`;
}

export function getPlatformUpdatePublicKeyPem(): string | null {
  const pem = process.env.PLATFORM_UPDATE_PUBLIC_KEY?.trim();
  return pem ? normalizePem(pem) : null;
}

export function signPlatformManifest(
  input: PlatformReleaseInput,
  privateKeyPem = process.env.PLATFORM_UPDATE_PRIVATE_KEY,
): PlatformUpdateManifest {
  if (!privateKeyPem?.trim()) {
    throw new Error('PLATFORM_UPDATE_PRIVATE_KEY is required');
  }
  const release = normalizedRelease(input);
  assertReleaseInput(release);
  const privateKey = createPrivateKey(normalizePem(privateKeyPem));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('PLATFORM_UPDATE_PRIVATE_KEY must be an Ed25519 private key');
  }
  const publicKey = createPublicKey(privateKey);
  const payload = platformManifestPayload(release);
  const fingerprint = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex');

  return {
    ...release,
    checksum: platformManifestChecksum(release),
    signature: {
      algorithm: 'Ed25519',
      encoding: 'base64',
      value: sign(null, payload, privateKey).toString('base64'),
      publicKeyFingerprint: `sha256:${fingerprint}`,
    },
  };
}

export function verifyPlatformManifest(
  manifest: PlatformUpdateManifest,
  publicKeyPem = getPlatformUpdatePublicKeyPem(),
): boolean {
  try {
    if (!publicKeyPem) return false;
    assertReleaseInput(manifest);
    if (
      manifest.signature?.algorithm !== 'Ed25519' ||
      manifest.signature?.encoding !== 'base64' ||
      !manifest.signature.value ||
      platformManifestChecksum(manifest) !== manifest.checksum
    ) {
      return false;
    }
    const publicKey = createPublicKey(normalizePem(publicKeyPem));
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    return verify(
      null,
      platformManifestPayload(manifest),
      publicKey,
      Buffer.from(manifest.signature.value, 'base64'),
    );
  } catch {
    return false;
  }
}

export function assertPlatformUpdateManifest(
  value: unknown,
): asserts value is PlatformUpdateManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest must be an object');
  const manifest = value as PlatformUpdateManifest;
  assertReleaseInput(manifest);
  if (!/^sha256:[a-f0-9]{64}$/i.test(manifest.checksum || '')) {
    throw new Error('Manifest checksum must be a SHA-256 digest');
  }
  if (
    !manifest.signature ||
    manifest.signature.algorithm !== 'Ed25519' ||
    manifest.signature.encoding !== 'base64' ||
    !manifest.signature.value
  ) {
    throw new Error('Manifest must include an Ed25519 signature');
  }
}

function assertReleaseInput(input: PlatformReleaseInput): void {
  if (!input.version || typeof input.version !== 'string') {
    throw new Error('Manifest version is required');
  }
  if (
    !input.releaseDate ||
    typeof input.releaseDate !== 'string' ||
    Number.isNaN(Date.parse(input.releaseDate))
  ) {
    throw new Error('Manifest releaseDate must be an ISO date');
  }
  if (!input.images || typeof input.images !== 'object' || Array.isArray(input.images)) {
    throw new Error('Manifest images must be an object');
  }
  const images = Object.entries(input.images);
  if (images.length === 0) throw new Error('Manifest must contain at least one image');
  for (const [name, digest] of images) {
    if (!name || !IMMUTABLE_IMAGE_PATTERN.test(digest)) {
      throw new Error(`Image ${name || '<unknown>'} must use an immutable SHA-256 digest`);
    }
  }
}
