import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    try {
      return super.canActivate(context);
    } catch {
      throw new UnauthorizedException('Google OAuth is not configured');
    }
  }

  handleRequest(err: any, user: any) {
    if (err || !user) return null;
    return user;
  }
}

@Injectable()
export class MicrosoftAuthGuard extends AuthGuard('microsoft') {
  canActivate(context: ExecutionContext) {
    try {
      return super.canActivate(context);
    } catch {
      throw new UnauthorizedException('Microsoft OAuth is not configured');
    }
  }

  handleRequest(err: any, user: any) {
    if (err || !user) return null;
    return user;
  }
}
