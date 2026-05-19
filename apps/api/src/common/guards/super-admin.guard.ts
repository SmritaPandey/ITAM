import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard that restricts access to platform super-admins only.
 * Checks the `isSuperAdmin` flag on the JWT-decoded user object.
 * Must be used AFTER JwtAuthGuard so req.user is populated.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }

    return true;
  }
}
