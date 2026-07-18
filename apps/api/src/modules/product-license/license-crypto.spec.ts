import {
  encodeLicenseChallenge,
  parseLicenseChallenge,
  signEntitlement,
  verifySignedLicense,
} from './license-crypto';

describe('license crypto', () => {
  it('round-trips an air-gap challenge', () => {
    const challenge = {
      version: 1 as const,
      installId: 'inst-test',
      fingerprint: 'fingerprint',
      nonce: 'nonce',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(parseLicenseChallenge(encodeLicenseChallenge(challenge))).toEqual(challenge);
  });

  it('protects the activation nonce with the entitlement signature', () => {
    const signed = signEntitlement({
      licenseKey: 'QS-TEST-TEST-TEST-TEST',
      customerName: 'Test',
      plan: 'ON_PREMISE',
      maxAssets: 10,
      maxUsers: 5,
      allowedModules: ['DASHBOARD'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      iss: 'neurq',
      fingerprint: 'fingerprint',
      installId: 'inst-test',
      activationNonce: 'expected',
    });
    expect(verifySignedLicense(signed).activationNonce).toBe('expected');
    signed.payload.activationNonce = 'tampered';
    expect(() => verifySignedLicense(signed)).toThrow('signature');
  });
});
