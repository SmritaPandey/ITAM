import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service';

/**
 * Sets Postgres GUC app.current_tenant for RLS policies when JWT user is present.
 * Must run after auth populates req.user (or no-ops).
 */
@Injectable()
export class TenantRlsMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    const tenantId = user?.tenantId;
    if (tenantId) {
      try {
        await this.prisma.setCurrentTenant(tenantId);
      } catch {
        // non-fatal — app still filters by tenantId in queries
      }
    }
    next();
  }
}
