#!/usr/bin/env node

import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const signerPath = resolve(repoRoot, 'apps/api/scripts/sign-platform-release.mjs');
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'qs-platform-signing-'));
const inputPath = resolve(temporaryDirectory, 'release.json');
const outputPath = resolve(temporaryDirectory, 'platform-release.json');

try {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  await writeFile(inputPath, JSON.stringify({
    version: 'test-1.0.0',
    releaseDate: '2026-07-19T00:00:00.000Z',
    images: {
      api: `sha256:${'a'.repeat(64)}`,
      web: `sha256:${'b'.repeat(64)}`,
    },
  }));

  const result = spawnSync(
    process.execPath,
    [signerPath, '--input', inputPath, '--output', outputPath],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PLATFORM_UPDATE_PRIVATE_KEY: privateKey
          .export({ type: 'pkcs8', format: 'pem' })
          .toString(),
      },
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Platform signing process failed');
  }

  const manifest = JSON.parse(await readFile(outputPath, 'utf8'));
  const payload = Buffer.from(JSON.stringify({
    version: manifest.version,
    releaseDate: manifest.releaseDate,
    images: Object.fromEntries(
      Object.entries(manifest.images).sort(([left], [right]) => left.localeCompare(right)),
    ),
  }));
  const checksum = `sha256:${createHash('sha256').update(payload).digest('hex')}`;
  if (manifest.checksum !== checksum) throw new Error('Platform manifest checksum verification failed');
  if (!verify(null, payload, publicKey, Buffer.from(manifest.signature.value, 'base64'))) {
    throw new Error('Platform manifest Ed25519 verification failed');
  }

  console.log('Platform release checksum and Ed25519 signing workflow verified.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
