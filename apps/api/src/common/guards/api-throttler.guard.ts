import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
    const authorization = String(req.headers?.authorization || '');
    const tokenFingerprint = authorization
      ? createHash('sha256').update(authorization).digest('hex').slice(0, 24)
      : '';
    const email = String(req.body?.email || '').trim().toLowerCase();
    const emailFingerprint = email
      ? createHash('sha256').update(email).digest('hex').slice(0, 24)
      : '';
    const agentId = String(
      req.params?.agentId ||
      req.params?.id ||
      req.body?.agentId ||
      req.body?.hostname ||
      '',
    );

    return [ip, tokenFingerprint, emailFingerprint, agentId].filter(Boolean).join(':');
  }
}
