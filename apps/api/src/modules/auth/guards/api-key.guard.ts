import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

/**
 * API Key guard — validates agent-to-server communication.
 * Expects header: X-Agent-Key: <tenant-api-key>
 * 
 * This guard is used for discovery agent endpoints that don't use JWT.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger('ApiKeyGuard');

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-agent-key'] || request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required for agent communication');
    }

    // Validate against tenant settings
    try {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          settings: {
            path: ['apiKey'],
            equals: apiKey,
          },
        },
      });

      if (!tenant) {
        // Fallback: check if it's a valid tenant ID (backward compatibility)
        const tenantById = await this.prisma.tenant.findUnique({
          where: { id: apiKey },
        });
        if (!tenantById) {
          this.logger.warn(`Invalid API key attempt from ${request.ip}`);
          throw new UnauthorizedException('Invalid API key');
        }
        request.tenantId = tenantById.id;
      } else {
        request.tenantId = tenant.id;
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`API key validation error: ${error}`);
      throw new UnauthorizedException('API key validation failed');
    }
  }
}
