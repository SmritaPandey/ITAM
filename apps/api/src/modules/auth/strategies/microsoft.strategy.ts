import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// passport-microsoft uses a default export
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MicrosoftStrategy = require('passport-microsoft').Strategy;

@Injectable()
export class MicrosoftOAuthStrategy extends PassportStrategy(MicrosoftStrategy, 'microsoft') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('MICROSOFT_CLIENT_ID') || '';
    const clientSecret = configService.get<string>('MICROSOFT_CLIENT_SECRET') || '';
    const callbackBase = configService.get<string>('OAUTH_CALLBACK_URL') || configService.get<string>('APP_URL') || 'http://localhost:4100';

    super({
      clientID,
      clientSecret,
      callbackURL: `${callbackBase}/api/v1/auth/microsoft/callback`,
      scope: ['user.read'],
      tenant: 'common',
      authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<void> {
    const user = {
      provider: 'microsoft',
      providerId: profile.id,
      email: profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName || '',
      firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || '',
      lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
      avatarUrl: null,
    };
    done(null, user);
  }
}
