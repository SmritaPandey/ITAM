#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { createPrivateKey, sign } = require('crypto');

function readJsonOrBase64(path) {
  const raw = fs.readFileSync(path, 'utf8').trim();
  return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
}

const [challengePath, licensePath, outputPath] = process.argv.slice(2);
if (!challengePath || !licensePath) {
  console.error(
    'Usage: LICENSE_PRIVATE_KEY_FILE=private.pem node scripts/sign-license-challenge.js <challenge.json> <license.lic> [response.lic]',
  );
  process.exit(1);
}

const keyPath = process.env.LICENSE_PRIVATE_KEY_FILE;
const inlineKey = process.env.LICENSE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!keyPath && !inlineKey) {
  console.error('Set LICENSE_PRIVATE_KEY_FILE or LICENSE_PRIVATE_KEY');
  process.exit(1);
}

const challenge = readJsonOrBase64(challengePath);
const license = readJsonOrBase64(licensePath);
if (
  challenge.version !== 1 ||
  !challenge.installId ||
  !challenge.fingerprint ||
  !challenge.nonce ||
  new Date(challenge.expiresAt).getTime() <= Date.now()
) {
  console.error('Challenge is invalid or expired');
  process.exit(1);
}
if (!license.payload) {
  console.error('License file does not contain an entitlement payload');
  process.exit(1);
}

const payload = {
  ...license.payload,
  allowedModules: [...(license.payload.allowedModules || [])].sort(),
  fingerprint: challenge.fingerprint,
  installId: challenge.installId,
  activationNonce: challenge.nonce,
  iat: new Date().toISOString(),
};
const ordered = {
  licenseKey: payload.licenseKey,
  customerName: payload.customerName,
  plan: payload.plan,
  maxAssets: payload.maxAssets,
  maxUsers: payload.maxUsers,
  allowedModules: payload.allowedModules,
  expiresAt: payload.expiresAt,
  iss: payload.iss || 'neurq',
  fingerprint: payload.fingerprint ?? null,
  installId: payload.installId,
  activationNonce: payload.activationNonce,
  iat: payload.iat,
};
const privateKey = createPrivateKey(
  inlineKey || fs.readFileSync(keyPath, 'utf8'),
);
const response = {
  version: 1,
  payload,
  signature: sign(null, Buffer.from(JSON.stringify(ordered), 'utf8'), privateKey).toString('base64'),
};
const output = outputPath || `${licensePath.replace(/\.lic$/i, '')}.response.lic`;
fs.writeFileSync(output, `${JSON.stringify(response, null, 2)}\n`, { mode: 0o600 });
console.log(`Signed activation response: ${output}`);
