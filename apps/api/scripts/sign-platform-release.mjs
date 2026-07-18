#!/usr/bin/env node

import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function normalizePem(value) {
  return value.replace(/\\n/g, '\n').trim();
}

function payloadFor(release) {
  return Buffer.from(JSON.stringify({
    version: release.version.trim(),
    releaseDate: release.releaseDate,
    images: Object.fromEntries(
      Object.entries(release.images).sort(([left], [right]) => left.localeCompare(right)),
    ),
  }));
}

const inputArg = argument('--input');
if (!inputArg) {
  throw new Error('Usage: sign-platform-release.mjs --input release.json [--output platform-release.json]');
}
const inputPath = resolve(process.cwd(), inputArg);
const outputPath = resolve(
  process.cwd(),
  argument('--output', 'apps/api/.artifacts/platform-release.json'),
);
const release = JSON.parse(await readFile(inputPath, 'utf8'));
if (!release.version || !release.releaseDate || !release.images || !Object.keys(release.images).length) {
  throw new Error('Input must contain version, releaseDate, and images');
}
for (const [name, digest] of Object.entries(release.images)) {
  if (!/^(?:[A-Za-z0-9._/:~-]+@)?sha256:[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(`Image ${name} must use an immutable SHA-256 digest`);
  }
}

const configuredKey = process.env.PLATFORM_UPDATE_PRIVATE_KEY?.trim();
if (!configuredKey) throw new Error('PLATFORM_UPDATE_PRIVATE_KEY is required');
const privateKey = createPrivateKey(normalizePem(configuredKey));
if (privateKey.asymmetricKeyType !== 'ed25519') {
  throw new Error('PLATFORM_UPDATE_PRIVATE_KEY must be Ed25519');
}
const publicKey = createPublicKey(privateKey);
const payload = payloadFor(release);
const signature = sign(null, payload, privateKey);
if (!verify(null, payload, publicKey, signature)) {
  throw new Error('Generated platform release signature failed local verification');
}

const manifest = {
  version: release.version.trim(),
  releaseDate: release.releaseDate,
  images: Object.fromEntries(
    Object.entries(release.images).sort(([left], [right]) => left.localeCompare(right)),
  ),
  checksum: `sha256:${createHash('sha256').update(payload).digest('hex')}`,
  signature: {
    algorithm: 'Ed25519',
    encoding: 'base64',
    value: signature.toString('base64'),
    publicKeyFingerprint: `sha256:${createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex')}`,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`Signed platform release manifest written to ${outputPath}`);
console.log(`Checksum: ${manifest.checksum}`);
