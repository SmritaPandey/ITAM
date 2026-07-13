import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { ModuleKey, MODULE_CATALOG } from '../utils/modules';
import { ProductLicenseService } from '../../modules/product-license/product-license.service';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private productLicense: ProductLicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<ModuleKey>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequireModule() decorator -> allow access
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Platform super admins are exempt from module locks
    if (user?.isSuperAdmin) {
      return true;
    }

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Access denied: tenant context missing');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, plan: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const allowedModules = await this.productLicense.getResolvedModulesAsync(
      tenant.plan,
      tenant.settings,
    );

    if (!allowedModules.includes(requiredModule)) {
      const displayName = MODULE_CATALOG[requiredModule] || requiredModule;
      throw new ForbiddenException(
        `Access denied: the module "${displayName}" is locked under your current subscription plan. Please upgrade to unlock.`,
      );
    }

    return true;
  }
}
