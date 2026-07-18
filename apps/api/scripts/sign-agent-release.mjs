#!/usr/bin/env node

import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const artifactPath = resolve(repoRoot, 'agent/qs-discovery-agent.js');
const outputFlagIndex = process.argv.indexOf('--output');
const outputPath = outputFlagIndex >= 0 && process.argv[outputFlagIndex + 1]
  ? resolve(process.cwd(), process.argv[outputFlagIndex + 1])
  : resolve(repoRoot, 'apps/api/.artifacts/agent-release.json');

function normalizePem(value) {
  return value.replace(/\\n/g, '\n').trim();
}

const artifact = await readFile(artifactPath);
const checksum = createHash('sha256').update(artifact).digest('hex');
const configuredKey = process.env.AGENT_UPDATE_PRIVATE_KEY?.trim();

let signature = null;
let publicKeyFingerprint = null;

if (configuredKey) {
  const privateKey = createPrivateKey(normalizePem(configuredKey));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`AGENT_UPDATE_PRIVATE_KEY must be Ed25519, received ${privateKey.asymmetricKeyType ?? 'unknown'}`);
  }

  const publicKey = createPublicKey(privateKey);
  signature = sign(null, artifact, privateKey).toString('base64');
  if (!verify(null, artifact, publicKey, Buffer.from(signature, 'base64'))) {
    throw new Error('Generated agent signature failed local verification');
  }

  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  publicKeyFingerprint = createHash('sha256').update(publicKeyDer).digest('hex');
} else {
  console.log('AGENT_UPDATE_PRIVATE_KEY is unset; writing checksum metadata without a signature.');
}

const metadata = {
  schemaVersion: 1,
  artifact: 'agent/qs-discovery-agent.js',
  checksum: {
    algorithm: 'sha256',
    value: checksum,
  },
  signature: signature
    ? {
        algorithm: 'Ed25519',
        encoding: 'base64',
        value: signature,
        publicKeyFingerprint: `sha256:${publicKeyFingerprint}`,
      }
    : null,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });

console.log(`Agent release metadata written to ${outputPath}`);
console.log(`SHA-256: ${checksum}`);
if (signature) console.log('Ed25519 signature generated and verified.');
