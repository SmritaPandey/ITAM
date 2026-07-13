import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req?.user?.tenantId;
    if (tenantId) {
      try {
        await this.prisma.setCurrentTenant(tenantId);
      } catch {
        // non-fatal
      }
    }
    return next.handle();
  }
}
