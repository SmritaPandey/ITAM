import { generateKeyPairSync } from 'crypto';
import {
  signPlatformManifest,
  verifyPlatformManifest,
  type PlatformReleaseInput,
} from './platform-update-crypto';

describe('platform update manifest signing', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const release: PlatformReleaseInput = {
    version: '2.3.0',
    releaseDate: '2026-07-19T00:00:00.000Z',
    images: {
      web: `sha256:${'a'.repeat(64)}`,
      api: `sha256:${'b'.repeat(64)}`,
    },
  };

  it('signs and verifies an Ed25519 manifest', () => {
    const manifest = signPlatformManifest(release, privateKeyPem);

    expect(manifest.signature.algorithm).toBe('Ed25519');
    expect(manifest.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(verifyPlatformManifest(manifest, publicKeyPem)).toBe(true);
  });

  it('rejects a manifest with a tampered image digest', () => {
    const manifest = signPlatformManifest(release, privateKeyPem);
    manifest.images.api = `sha256:${'c'.repeat(64)}`;

    expect(verifyPlatformManifest(manifest, publicKeyPem)).toBe(false);
  });

  it('rejects a manifest signed by another key', () => {
    const manifest = signPlatformManifest(release, privateKeyPem);
    const otherKey = generateKeyPairSync('ed25519').publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();

    expect(verifyPlatformManifest(manifest, otherKey)).toBe(false);
  });
});
