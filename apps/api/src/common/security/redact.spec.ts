import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('removes nested secrets without mutating the source', () => {
    const source = {
      snmpCommunity: 'private',
      adSync: { bindPassword: 'secret', host: 'ldap.example.com' },
      hypervisors: [{ username: 'root', password: 'p@ss', host: '10.0.0.1' }],
    };

    const result = redactSecrets(source, { preservePresence: true }) as any;

    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('p@ss');
    expect(result.hasSnmpCommunity).toBe(true);
    expect(result.adSync.hasBindPassword).toBe(true);
    expect(result.hypervisors[0].hasPassword).toBe(true);
    expect(source.hypervisors[0].password).toBe('p@ss');
  });
});
