import { PlatformUpdateService } from './platform-update.service';

describe('PlatformUpdateService', () => {
  const previous = {
    DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE,
    LICENSE_PRIVATE_KEY: process.env.LICENSE_PRIVATE_KEY,
    LICENSE_PUBLIC_KEY: process.env.LICENSE_PUBLIC_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns SaaS-safe owner status without requiring an on-prem manifest', async () => {
    process.env.DEPLOYMENT_MODE = 'saas';
    process.env.LICENSE_PRIVATE_KEY = 'x';
    process.env.LICENSE_PUBLIC_KEY = 'y';
    const service = new PlatformUpdateService();

    const result = await service.ownerStatus();

    expect(result.deploymentMode).toBe('saas');
    expect(result.channels.productLicense.privateKeyConfigured).toBe(true);
    expect(result.channels.productLicense.publicKeyConfigured).toBe(true);
    expect(result.onPrem).toBeNull();
    expect(result.note).toMatch(/SaaS hosts/);
  });
});
