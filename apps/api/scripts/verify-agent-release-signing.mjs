#!/usr/bin/env node

import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const artifactPath = resolve(repoRoot, 'agent/qs-discovery-agent.js');
const signerPath = resolve(repoRoot, 'apps/api/scripts/sign-agent-release.mjs');
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'qs-agent-signing-'));
const metadataPath = resolve(temporaryDirectory, 'agent-release.json');

try {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const result = spawnSync(
    process.execPath,
    [signerPath, '--output', metadataPath],
    {
      cwd: repoRoot,
      env: { ...process.env, AGENT_UPDATE_PRIVATE_KEY: privateKeyPem },
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Agent signing process failed');
  }

  const artifact = await readFile(artifactPath);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const checksum = createHash('sha256').update(artifact).digest('hex');
  if (metadata.checksum?.algorithm !== 'sha256' || metadata.checksum?.value !== checksum) {
    throw new Error('Agent release checksum verification failed');
  }
  if (metadata.signature?.algorithm !== 'Ed25519' || !metadata.signature?.value) {
    throw new Error('Agent release signature metadata is missing');
  }
  if (!verify(null, artifact, publicKey, Buffer.from(metadata.signature.value, 'base64'))) {
    throw new Error('Agent release signature verification failed');
  }

  console.log('Agent release checksum and Ed25519 signing workflow verified.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
