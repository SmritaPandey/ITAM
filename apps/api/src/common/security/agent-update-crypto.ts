import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

export function getAgentUpdatePrivateKey() {
  const pem = process.env.AGENT_UPDATE_PRIVATE_KEY?.trim();
  if (!pem) return null;
  return createPrivateKey(normalizePem(pem));
}

export function getAgentUpdatePublicKeyPem(): string | null {
  const pem = process.env.AGENT_UPDATE_PUBLIC_KEY?.trim();
  if (pem) return normalizePem(pem);
  return null;
}

export function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function signAgentArtifact(content: Buffer): { checksum: string; signature: string } | null {
  const privateKey = getAgentUpdatePrivateKey();
  if (!privateKey) return null;
  const checksum = sha256Hex(content);
  const signature = sign(null, content, privateKey).toString('base64');
  return { checksum, signature };
}

export function verifyAgentArtifact(
  content: Buffer,
  checksum: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  if (sha256Hex(content).toLowerCase() !== checksum.toLowerCase()) return false;
  return verify(null, content, createPublicKey(normalizePem(publicKeyPem)), Buffer.from(signature, 'base64'));
}

/** Resolve bundled agent source for signing/version metadata. */
export function loadAgentSource(): Buffer | null {
  const candidates = [
    join(process.cwd(), 'agent', 'qs-discovery-agent.js'),
    join(process.cwd(), '..', '..', 'agent', 'qs-discovery-agent.js'),
    join(__dirname, '..', '..', '..', '..', '..', 'agent', 'qs-discovery-agent.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate);
  }
  return null;
}
