jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sealVaultValue } from '../../common/security/vault-crypto';
import { SsoService } from './sso.service';

describe('SsoService OIDC/SAML acceptance flows', () => {
  const originalKey = process.env.VAULT_ENCRYPTION_KEY;
  const originalRedis = process.env.REDIS_URL;

  beforeAll(() => {
    process.env.VAULT_ENCRYPTION_KEY = 'test-only-vault-encryption-key-at-least-32-characters';
    delete process.env.REDIS_URL;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalKey;
    if (originalRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedis;
  });

  function makeService(prisma: any, authService: any = {}) {
    return new SsoService(
      prisma,
      new ConfigService({
        API_PUBLIC_URL: 'https://api.example.test',
        PORT: 4100,
      }),
      authService,
    );
  }

  it('stores OIDC state and completes token exchange without putting secrets in redirects', async () => {
    const sealed = sealVaultValue('oidc-client-secret');
    const config = {
      id: 'oidc-1',
      tenantId: 'tenant-1',
      provider: 'OIDC',
      enabled: true,
      clientId: 'client-id',
      clientSecret: sealed,
      issuer: 'https://idp.example.test',
      ssoUrl: 'https://idp.example.test/authorize',
    };
    const prisma = {
      ssoConfig: {
        findUnique: jest.fn(async ({ where }) => (where.id === config.id ? config : null)),
      },
    };
    const authService = {
      oauthLogin: jest.fn(async () => ({
        accessToken: 'access',
        refreshToken: 'refresh',
        isNewUser: false,
      })),
      createOAuthExchangeCode: jest.fn(() => 'one-time-code'),
    };
    const service = makeService(prisma, authService);
    const httpJson = jest
      .fn()
      .mockResolvedValueOnce({ access_token: 'idp-access' })
      .mockResolvedValueOnce({
        sub: 'sub-1',
        email: 'user@example.com',
        given_name: 'Ada',
        family_name: 'Lovelace',
      });
    (service as any).httpJson = httpJson;

    const start = await service.buildOidcStartUrl('oidc-1');
    expect(start.url).toContain('https://idp.example.test/authorize?');
    expect(start.url).toContain('client_id=client-id');
    expect(start.url).toContain('state=');
    expect(start.url).not.toContain('oidc-client-secret');
    expect(start.url).not.toContain('access_token');
    expect(start.url).not.toContain('refresh_token');
    expect(start.url).not.toMatch(/[?&]token=/);

    const result = await service.handleOidcCallback('auth-code', start.state);
    expect(authService.oauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        tenantIdHint: 'tenant-1',
        providerId: 'sub-1',
      }),
    );
    expect(result).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
    expect(httpJson).toHaveBeenNthCalledWith(
      1,
      'https://idp.example.test/token',
      'POST',
      expect.stringContaining('client_secret=oidc-client-secret'),
      expect.any(Object),
    );

    await expect(service.handleOidcCallback('auth-code', start.state)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await service.onModuleDestroy();
  });

  it('rejects OIDC callbacks with missing/expired state', async () => {
    const service = makeService({ ssoConfig: { findUnique: jest.fn() } }, {});
    await expect(service.handleOidcCallback('code', 'missing-state')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await service.onModuleDestroy();
  });

  it('binds SAML ACS to RelayState configId and maps assertion email via oauthLogin', async () => {
    const config = {
      id: 'saml-1',
      tenantId: 'tenant-1',
      provider: 'SAML',
      enabled: true,
      ssoUrl: 'https://idp.example.test/sso',
      issuer: 'https://idp.example.test/entity',
      entityId: 'https://api.example.test/sp',
      certificate: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
      groupRoleMap: { Admins: 'Tenant Admin' },
    };
    const prisma = {
      ssoConfig: {
        findUnique: jest.fn(async ({ where }) => (where.id === config.id ? config : null)),
        findMany: jest.fn(),
      },
    };
    const authService = {
      oauthLogin: jest.fn(async () => ({
        accessToken: 'saml-access',
        refreshToken: 'saml-refresh',
        isNewUser: false,
      })),
    };
    const service = makeService(prisma, authService);

    const parseLoginResponse = jest.fn(async () => ({
      extract: {
        nameID: 'user@example.com',
        attributes: {
          email: 'user@example.com',
          givenName: 'Ada',
          surname: 'Lovelace',
          groups: ['Admins'],
        },
      },
    }));
    jest.isolateModules(() => {
      jest.doMock('samlify', () => ({
        setSchemaValidator: jest.fn(),
        Constants: { namespace: { binding: { post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect' } } },
        ServiceProvider: jest.fn(() => ({
          parseLoginResponse,
          createLoginRequest: jest.fn(() => ({
            context: 'https://idp.example.test/sso?SAMLRequest=abc&RelayState=old',
          })),
          assertionConsumerService: [],
        })),
        IdentityProvider: jest.fn(() => ({})),
      }));
    });

    // Directly stub the ACS parse path used by the service under test
    const samlify = require('samlify');
    jest.spyOn(samlify, 'setSchemaValidator').mockImplementation(() => undefined);
    jest.spyOn(samlify, 'ServiceProvider').mockImplementation(
      () =>
        ({
          parseLoginResponse,
        }) as any,
    );
    jest.spyOn(samlify, 'IdentityProvider').mockImplementation(() => ({}) as any);

    const relay = Buffer.from(JSON.stringify({ configId: 'saml-1' })).toString('base64url');
    const result = await service.handleSamlAcs({
      SAMLResponse: Buffer.from('<Response/>').toString('base64'),
      RelayState: relay,
    });

    expect(prisma.ssoConfig.findUnique).toHaveBeenCalledWith({ where: { id: 'saml-1' } });
    expect(authService.oauthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'saml',
        email: 'user@example.com',
        tenantIdHint: 'tenant-1',
        preferredRole: 'Tenant Admin',
      }),
    );
    expect(result).toMatchObject({ accessToken: 'saml-access' });
    await service.onModuleDestroy();
  });

  it('refuses SAML ACS when configId cannot be resolved (cross-tenant guard)', async () => {
    const prisma = {
      ssoConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma, {});
    const samlify = require('samlify');
    jest.spyOn(samlify, 'setSchemaValidator').mockImplementation(() => undefined);

    await expect(
      service.handleSamlAcs({
        SAMLResponse: Buffer.from('<Response><Issuer>unknown</Issuer></Response>').toString(
          'base64',
        ),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.onModuleDestroy();
  });

  it('builds SAML start URL with RelayState carrying configId', async () => {
    const config = {
      id: 'saml-2',
      tenantId: 'tenant-1',
      provider: 'SAML',
      enabled: true,
      ssoUrl: 'https://idp.example.test/sso',
      issuer: 'https://idp.example.test/entity',
      entityId: 'sp',
      certificate: null,
    };
    const prisma = {
      ssoConfig: {
        findUnique: jest.fn().mockResolvedValue(config),
      },
    };
    const service = makeService(prisma, {});
    const start = await service.buildSamlStart('saml-2');
    expect(start.url).toContain('https://idp.example.test/sso');
    expect(start.url).toContain('RelayState=');
    const relayParam = new URL(start.url!).searchParams.get('RelayState')!;
    const parsed = JSON.parse(Buffer.from(relayParam, 'base64url').toString('utf8'));
    expect(parsed).toEqual({ configId: 'saml-2' });
    await service.onModuleDestroy();
  });
});
