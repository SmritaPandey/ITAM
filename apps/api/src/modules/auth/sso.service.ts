import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthService } from './auth.service';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

export interface SsoProviderPublic {
  id: string;
  provider: string;
  name: string;
  type: 'OIDC' | 'SAML' | 'GOOGLE' | 'MICROSOFT';
  startUrl: string;
  enabled: boolean;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly pendingStates = new Map<string, { configId: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  /**
   * Public list for the login page: env Google/MS + enabled tenant SSO configs.
   * Without a tenant slug, only platform env providers are returned.
   */
  async listPublicProviders(tenantSlug?: string): Promise<{ providers: SsoProviderPublic[] }> {
    const apiBase =
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.get<string>('OAUTH_CALLBACK_URL') ||
      `http://localhost:${this.configService.get('PORT') || 4100}`;
    const prefix = `${apiBase.replace(/\/$/, '')}/api/v1`;

    const providers: SsoProviderPublic[] = [];

    const googleEnabled = !!(
      this.configService.get('GOOGLE_CLIENT_ID') &&
      this.configService.get('GOOGLE_CLIENT_SECRET')
    );
    const microsoftEnabled = !!(
      this.configService.get('MICROSOFT_CLIENT_ID') &&
      this.configService.get('MICROSOFT_CLIENT_SECRET')
    );

    if (googleEnabled) {
      providers.push({
        id: 'google',
        provider: 'GOOGLE',
        name: 'Google',
        type: 'GOOGLE',
        startUrl: `${prefix}/auth/google`,
        enabled: true,
      });
    }
    if (microsoftEnabled) {
      providers.push({
        id: 'microsoft',
        provider: 'MICROSOFT',
        name: 'Microsoft',
        type: 'MICROSOFT',
        startUrl: `${prefix}/auth/microsoft`,
        enabled: true,
      });
    }

    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      });
      if (tenant) {
        const configs = await this.prisma.ssoConfig.findMany({
          where: { tenantId: tenant.id, enabled: true },
        });
        for (const c of configs) {
          const type = this.normalizeType(c.provider);
          providers.push({
            id: c.id,
            provider: c.provider,
            name: c.provider === 'SAML' ? 'Enterprise SAML' : c.provider === 'OIDC' ? 'OIDC SSO' : c.provider,
            type,
            startUrl:
              type === 'SAML'
                ? `${prefix}/auth/sso/saml/${c.id}/start`
                : `${prefix}/auth/sso/oidc/${c.id}/start`,
            enabled: true,
          });
        }
      }
    }

    return { providers };
  }

  async listConfigs(tenantId: string) {
    const rows = await this.prisma.ssoConfig.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
    });
    return rows.map((r) => this.sanitize(r));
  }

  async getConfig(id: string, tenantId: string) {
    const row = await this.prisma.ssoConfig.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('SSO config not found');
    return this.sanitize(row);
  }

  async createConfig(tenantId: string, data: {
    provider: string;
    enabled?: boolean;
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
    clientId?: string;
    clientSecret?: string;
    issuer?: string;
    metadataUrl?: string;
    groupRoleMap?: Record<string, string>;
  }) {
    const provider = (data.provider || '').toUpperCase();
    if (!['SAML', 'OIDC', 'GOOGLE', 'MICROSOFT'].includes(provider)) {
      throw new BadRequestException('provider must be SAML, OIDC, GOOGLE, or MICROSOFT');
    }
    const row = await this.prisma.ssoConfig.create({
      data: {
        tenantId,
        provider,
        enabled: data.enabled ?? false,
        entityId: data.entityId,
        ssoUrl: data.ssoUrl,
        certificate: data.certificate,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        issuer: data.issuer,
        metadataUrl: data.metadataUrl,
        groupRoleMap: data.groupRoleMap || {},
      },
    });
    return this.sanitize(row);
  }

  async updateConfig(id: string, tenantId: string, data: Partial<{
    enabled: boolean;
    entityId: string;
    ssoUrl: string;
    certificate: string;
    clientId: string;
    clientSecret: string;
    issuer: string;
    metadataUrl: string;
    groupRoleMap: Record<string, string>;
  }>) {
    await this.getConfig(id, tenantId);
    const row = await this.prisma.ssoConfig.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
        ...(data.ssoUrl !== undefined ? { ssoUrl: data.ssoUrl } : {}),
        ...(data.certificate !== undefined ? { certificate: data.certificate } : {}),
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.clientSecret !== undefined ? { clientSecret: data.clientSecret } : {}),
        ...(data.issuer !== undefined ? { issuer: data.issuer } : {}),
        ...(data.metadataUrl !== undefined ? { metadataUrl: data.metadataUrl } : {}),
        ...(data.groupRoleMap !== undefined ? { groupRoleMap: data.groupRoleMap } : {}),
      },
    });
    return this.sanitize(row);
  }

  async deleteConfig(id: string, tenantId: string) {
    await this.getConfig(id, tenantId);
    await this.prisma.ssoConfig.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Build OIDC authorization code start URL for a stored config.
   * Falls back to Google/MS well-known endpoints when provider is GOOGLE/MICROSOFT.
   */
  async buildOidcStartUrl(configId: string): Promise<{ url: string; state: string }> {
    const config = await this.prisma.ssoConfig.findUnique({ where: { id: configId } });
    if (!config || !config.enabled) throw new NotFoundException('SSO provider not found or disabled');

    const type = this.normalizeType(config.provider);
    if (type === 'SAML') {
      throw new BadRequestException('Use /auth/sso/saml/:id/start for SAML providers');
    }

    const apiBase =
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.get<string>('OAUTH_CALLBACK_URL') ||
      `http://localhost:${this.configService.get('PORT') || 4100}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/oidc/callback`;

    let clientId = config.clientId || '';
    let authEndpoint = config.ssoUrl || '';
    let issuer = config.issuer || '';

    if (config.provider === 'GOOGLE' || (!authEndpoint && config.provider === 'OIDC' && issuer.includes('accounts.google'))) {
      clientId = clientId || this.configService.get('GOOGLE_CLIENT_ID') || '';
      authEndpoint = authEndpoint || 'https://accounts.google.com/o/oauth2/v2/auth';
    }
    if (config.provider === 'MICROSOFT' || (!authEndpoint && issuer.includes('login.microsoftonline'))) {
      clientId = clientId || this.configService.get('MICROSOFT_CLIENT_ID') || '';
      const tenant = issuer.match(/login\.microsoftonline\.com\/([^/]+)/)?.[1] || 'common';
      authEndpoint = authEndpoint || `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
    }

    if (!clientId || !authEndpoint) {
      throw new BadRequestException(
        'OIDC clientId and authorization URL (ssoUrl) are required. Configure the SSO provider or set GOOGLE_/MICROSOFT_ env vars.',
      );
    }

    const state = crypto.randomBytes(24).toString('hex');
    this.pendingStates.set(state, { configId: config.id, expiresAt: Date.now() + 10 * 60 * 1000 });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
    });

    return { url: `${authEndpoint}?${params.toString()}`, state };
  }

  /**
   * OIDC authorization-code callback skeleton — exchanges code, loads userinfo, issues app JWT.
   */
  async handleOidcCallback(code: string, state: string) {
    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired OIDC state');
    }

    const config = await this.prisma.ssoConfig.findUnique({ where: { id: pending.configId } });
    if (!config) throw new UnauthorizedException('SSO config missing');

    const apiBase =
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.get<string>('OAUTH_CALLBACK_URL') ||
      `http://localhost:${this.configService.get('PORT') || 4100}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/oidc/callback`;

    let clientId = config.clientId || '';
    let clientSecret = config.clientSecret || '';
    let tokenUrl = '';
    let userInfoUrl = '';

    if (config.provider === 'GOOGLE') {
      clientId = clientId || this.configService.get('GOOGLE_CLIENT_ID') || '';
      clientSecret = clientSecret || this.configService.get('GOOGLE_CLIENT_SECRET') || '';
      tokenUrl = 'https://oauth2.googleapis.com/token';
      userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
    } else if (config.provider === 'MICROSOFT') {
      clientId = clientId || this.configService.get('MICROSOFT_CLIENT_ID') || '';
      clientSecret = clientSecret || this.configService.get('MICROSOFT_CLIENT_SECRET') || '';
      const tenant = config.issuer?.match(/login\.microsoftonline\.com\/([^/]+)/)?.[1] || 'common';
      tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
      userInfoUrl = 'https://graph.microsoft.com/oidc/userinfo';
    } else {
      // Generic OIDC — derive from issuer if possible
      const issuer = (config.issuer || '').replace(/\/$/, '');
      if (!issuer) throw new BadRequestException('OIDC issuer is required for token exchange');
      tokenUrl = `${issuer}/token`;
      userInfoUrl = `${issuer}/userinfo`;
    }

    if (!clientId || !clientSecret || !tokenUrl) {
      throw new BadRequestException('OIDC client credentials incomplete');
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokens = await this.httpJson(tokenUrl, 'POST', tokenBody.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const accessToken = tokens?.access_token;
    if (!accessToken) {
      this.logger.error(`OIDC token exchange failed: ${JSON.stringify(tokens)}`);
      throw new UnauthorizedException('OIDC token exchange failed');
    }

    const profile = await this.httpJson(userInfoUrl, 'GET', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    const email = profile.email || profile.preferred_username || profile.upn;
    if (!email) throw new UnauthorizedException('OIDC provider did not return an email');

    return this.authService.oauthLogin({
      provider: config.provider.toLowerCase(),
      providerId: String(profile.sub || profile.oid || profile.id || email),
      email,
      firstName: profile.given_name || profile.name?.split?.(' ')?.[0] || '',
      lastName: profile.family_name || '',
      avatarUrl: profile.picture || null,
    });
  }

  /**
   * SAML SP-initiated start — build AuthnRequest and redirect to IdP.
   */
  async buildSamlStart(configId: string): Promise<{
    url?: string;
    message: string;
    metadata?: { entityId?: string; ssoUrl?: string; hasCertificate: boolean };
  }> {
    const config = await this.prisma.ssoConfig.findUnique({ where: { id: configId } });
    if (!config || !config.enabled) throw new NotFoundException('SAML provider not found or disabled');
    if (!config.ssoUrl) {
      return {
        message:
          'SAML metadata is stored but no SSO URL is configured. Set ssoUrl (IdP redirect URL) and certificate.',
        metadata: {
          entityId: config.entityId || undefined,
          ssoUrl: config.ssoUrl || undefined,
          hasCertificate: !!config.certificate,
        },
      };
    }

    const apiBase =
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.get<string>('SAML_CALLBACK_URL') ||
      `http://localhost:${this.configService.get('PORT') || 4100}`;
    const acsUrl = `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/saml/callback`;
    const spEntityId =
      config.entityId ||
      `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/saml/${config.id}/metadata`;
    const relay = Buffer.from(JSON.stringify({ configId })).toString('base64url');

    try {
      const samlify = require('samlify');
      samlify.setSchemaValidator({ validate: () => Promise.resolve('skipped') });

      const sp = samlify.ServiceProvider({
        entityID: spEntityId,
        assertionConsumerService: [
          { Binding: samlify.Constants.namespace.binding.post, Location: acsUrl },
        ],
        authnRequestsSigned: false,
      });

      const idp = samlify.IdentityProvider({
        entityID: config.issuer || config.entityId || config.ssoUrl || 'idp',
        singleSignOnService: [
          {
            Binding: samlify.Constants.namespace.binding.redirect,
            Location: config.ssoUrl,
          },
          {
            Binding: samlify.Constants.namespace.binding.post,
            Location: config.ssoUrl,
          },
        ],
        ...(config.certificate
          ? { signingCert: this.normalizePem(config.certificate) }
          : {}),
      });

      const { context } = sp.createLoginRequest(idp, 'redirect');
      // context is the full redirect URL including SAMLRequest + RelayState placeholders
      const url = context.includes('RelayState=')
        ? context.replace(/RelayState=[^&]*/, `RelayState=${encodeURIComponent(relay)}`)
        : `${context}${context.includes('?') ? '&' : '?'}RelayState=${encodeURIComponent(relay)}`;

      return {
        url,
        message: 'Redirect to IdP with AuthnRequest',
        metadata: {
          entityId: spEntityId,
          ssoUrl: config.ssoUrl,
          hasCertificate: !!config.certificate,
        },
      };
    } catch (err: any) {
      this.logger.warn(`SAML AuthnRequest build failed, falling back to SSO URL: ${err?.message}`);
      const sep = config.ssoUrl.includes('?') ? '&' : '?';
      return {
        url: `${config.ssoUrl}${sep}RelayState=${encodeURIComponent(relay)}`,
        message: 'Redirect to IdP SSO URL (AuthnRequest fallback)',
        metadata: {
          entityId: config.entityId || undefined,
          ssoUrl: config.ssoUrl || undefined,
          hasCertificate: !!config.certificate,
        },
      };
    }
  }

  /**
   * SAML Assertion Consumer Service — validate signed Response with IdP certificate.
   */
  async handleSamlAcs(body: {
    SAMLResponse?: string;
    RelayState?: string;
    configId?: string;
  }) {
    const samlify = require('samlify');
    samlify.setSchemaValidator({
      validate: () => Promise.resolve('skipped'),
    });

    let configId = body.configId;
    if (!configId && body.RelayState) {
      try {
        const parsed = JSON.parse(Buffer.from(body.RelayState, 'base64url').toString('utf8'));
        configId = parsed.configId;
      } catch {
        // RelayState may be opaque from IdP
      }
    }

    let config = configId
      ? await this.prisma.ssoConfig.findUnique({ where: { id: configId } })
      : null;

    if (!config) {
      // Fall back to first enabled SAML config (IdP-initiated)
      config = await this.prisma.ssoConfig.findFirst({
        where: { provider: 'SAML', enabled: true },
      });
    }
    if (!config || !config.enabled) {
      throw new UnauthorizedException('No enabled SAML configuration found');
    }
    if (!config.certificate) {
      throw new BadRequestException('SAML IdP certificate is required on SsoConfig');
    }

    const apiBase =
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.get<string>('SAML_CALLBACK_URL') ||
      `http://localhost:${this.configService.get('PORT') || 4100}`;
    const acsUrl = `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/saml/callback`;
    const spEntityId =
      config.entityId ||
      `${apiBase.replace(/\/$/, '')}/api/v1/auth/sso/saml/${config.id}/metadata`;

    const sp = samlify.ServiceProvider({
      entityID: spEntityId,
      assertionConsumerService: [
        { Binding: samlify.Constants.namespace.binding.post, Location: acsUrl },
      ],
    });

    const idp = samlify.IdentityProvider({
      entityID: config.issuer || config.entityId || config.ssoUrl || 'idp',
      singleSignOnService: [
        {
          Binding: samlify.Constants.namespace.binding.redirect,
          Location: config.ssoUrl || 'https://idp.example/sso',
        },
      ],
      signingCert: this.normalizePem(config.certificate),
      wantAuthnResponseSigned: true,
    });

    const { extract } = await sp.parseLoginResponse(idp, 'post', {
      body: { SAMLResponse: body.SAMLResponse, RelayState: body.RelayState },
    });

    const attrs = extract?.attributes || {};
    const nameId = extract?.nameID || attrs.email || attrs.mail || attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
    const email =
      attrs.email ||
      attrs.mail ||
      attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      (typeof nameId === 'string' && nameId.includes('@') ? nameId : null);

    if (!email) {
      throw new UnauthorizedException('SAML assertion did not include an email attribute');
    }

    const groupsRaw =
      attrs.groups ||
      attrs.memberOf ||
      attrs['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] ||
      [];
    const groups = Array.isArray(groupsRaw) ? groupsRaw : [groupsRaw].filter(Boolean);
    const groupRoleMap = (config.groupRoleMap as Record<string, string>) || {};
    let mappedRole: string | undefined;
    for (const g of groups) {
      if (groupRoleMap[g]) {
        mappedRole = groupRoleMap[g];
        break;
      }
    }

    const result = await this.authService.oauthLogin({
      provider: 'saml',
      providerId: String(nameId || email),
      email: String(email).toLowerCase(),
      firstName: attrs.firstName || attrs.givenName || attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
      lastName: attrs.lastName || attrs.surname || attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
      avatarUrl: null,
      tenantIdHint: config.tenantId,
      preferredRole: mappedRole,
    });

    this.logger.log(`SAML ACS login for ${email} (tenant ${config.tenantId})`);
    return result;
  }

  private sanitize(row: any) {
    const { clientSecret, certificate, ...rest } = row;
    return {
      ...rest,
      hasClientSecret: !!clientSecret,
      hasCertificate: !!certificate,
    };
  }

  private normalizePem(cert: string): string {
    const trimmed = (cert || '').trim();
    if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;
    const body = trimmed.replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g) || [body];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
  }

  private normalizeType(provider: string): SsoProviderPublic['type'] {
    const p = (provider || '').toUpperCase();
    if (p === 'SAML') return 'SAML';
    if (p === 'GOOGLE') return 'GOOGLE';
    if (p === 'MICROSOFT') return 'MICROSOFT';
    return 'OIDC';
  }

  private httpJson(
    urlStr: string,
    method: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const u = new URL(urlStr);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method,
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}),
            ...headers,
          },
          timeout: 15000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OIDC HTTP timeout'));
      });
      if (body) req.write(body);
      req.end();
    });
  }
}
