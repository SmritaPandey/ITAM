import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest(err: any, user: any) {
    // Don't throw on failure — we redirect gracefully
    if (err || !user) return null;
    return user;
  }
}

@Injectable()
export class MicrosoftAuthGuard extends AuthGuard('microsoft') {
  handleRequest(err: any, user: any) {
    if (err || !user) return null;
    return user;
  }
}
