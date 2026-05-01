import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, ip, headers } = request;

    // Only audit mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async () => {
          try {
            const user = request.user;
            if (!user) return;

            const action = this.getAction(method, url);
            const resourceType = this.getResourceType(url);
            const resourceId = this.getEntityId(url);
            const module = resourceType;

            // Hash chain for tamper detection
            const lastLog = await this.prisma.auditLog.findFirst({
              where: { tenantId: user.tenantId },
              orderBy: { timestamp: 'desc' },
              select: { hash: true },
            });

            const prevHash = lastLog?.hash || 'GENESIS';
            const payload = JSON.stringify({
              prevHash, tenantId: user.tenantId, actorId: user.sub,
              action, resourceType, resourceId, timestamp: new Date().toISOString(),
            });
            const hash = crypto.createHash('sha256').update(payload).digest('hex');

            await this.prisma.auditLog.create({
              data: {
                tenant: { connect: { id: user.tenantId } },
                actor: { connect: { id: user.sub } },
                action,
                resourceType,
                resourceId,
                module,
                actorIp: ip || headers['x-forwarded-for'] || 'unknown',
                actorAgent: headers['user-agent'] || 'unknown',
                metadata: {
                  method, url,
                  requestBody: this.sanitizeBody(body),
                  duration: Date.now() - startTime,
                },
                hash,
                prevHash,
              },
            });
          } catch (err) {
            // Audit logging should never break the request
            console.error('[AuditLog] Failed to log:', (err as Error).message);
          }
        },
      }),
    );
  }

  private getAction(method: string, url: string): string {
    if (url.includes('/login')) return 'LOGIN';
    if (url.includes('/logout')) return 'LOGOUT';
    if (url.includes('/status')) return 'STATUS_CHANGE';
    if (url.includes('/comments')) return 'COMMENT_ADDED';
    const map: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
    return map[method] || 'UNKNOWN';
  }

  private getResourceType(url: string): string {
    const segments = url.replace('/api/v1/', '').split('/').filter(Boolean);
    return segments[0] || 'unknown';
  }

  private getEntityId(url: string): string | undefined {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const match = url.match(uuidRegex);
    return match ? match[0] : undefined;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'passwordHash', 'secret', 'token', 'refreshToken', 'mfaSecret'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }
}
