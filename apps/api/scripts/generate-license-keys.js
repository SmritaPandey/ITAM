#!/usr/bin/env node
/**
 * Generate Ed25519 PEM pair for QS Assets product licensing.
 * Usage: node scripts/generate-license-keys.js
 * Put PRIVATE on SaaS only; PUBLIC on SaaS + all on-prem installs.
 */
const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();

console.log('# LICENSE_PRIVATE_KEY (SaaS issuer only)\n');
console.log(JSON.stringify(priv));
console.log('\n# LICENSE_PUBLIC_KEY (SaaS + on-prem)\n');
console.log(JSON.stringify(pub));
