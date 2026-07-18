import { SettingsService } from './settings.service';

describe('SettingsService secret redaction', () => {
  const tenant = {
    id: 'tenant-1',
    name: 'Example',
    slug: 'example',
    domain: 'example.com',
    plan: 'ENTERPRISE',
    settings: {
      snmpCommunity: 'private-community',
      adSync: { bindPassword: 'ldap-secret', host: 'ldap.example.com' },
      hypervisors: [{ host: '10.0.0.1', password: 'hypervisor-secret' }],
    },
  };
  const prisma: any = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(tenant),
      update: jest.fn().mockResolvedValue(tenant),
    },
  };
  const service = new SettingsService(prisma);

  it('never returns plaintext settings secrets', async () => {
    const result = await service.getSettings('tenant-1');
    const json = JSON.stringify(result);

    expect(json).not.toContain('private-community');
    expect(json).not.toContain('ldap-secret');
    expect(json).not.toContain('hypervisor-secret');
    expect((result as any).hasSnmpCommunity).toBe(true);
    expect((result as any).adSync.hasBindPassword).toBe(true);
  });

  it('redacts the response after updating a secret', async () => {
    const result = await service.updateSettings('tenant-1', { snmpCommunity: 'new-secret' });
    expect(JSON.stringify(result)).not.toContain('private-community');
    expect(JSON.stringify(result)).not.toContain('new-secret');
  });
});
