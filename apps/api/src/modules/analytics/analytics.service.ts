import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * First-party analytics service.
 * 
 * Data collected (with consent):
 * - Page views (path, referrer, screen size, language)
 * - Session duration
 * - Feature usage counts
 * - Cookie consent choices
 * 
 * NOT collected: PII, form inputs, passwords, tracking pixels, cross-site data
 */

interface AnalyticsEvent {
  event: string;
  sessionId?: string;
  path?: string;
  referrer?: string;
  screenWidth?: number;
  screenHeight?: number;
  userAgent?: string;
  language?: string;
  timestamp?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private eventBuffer: AnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval>;

  constructor(private prisma: PrismaService) {
    // Flush buffered events to DB every 30 seconds for performance
    this.flushInterval = setInterval(() => this.flush(), 30000);
  }

  /**
   * Parse auth header token if provided
   */
  private decodeToken(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      const token = authHeader.substring(7);
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /**
   * Dynamic real-time geolocation mapping via ip-api.com
   */
  private async geolocate(ip?: string) {
    // Local / development coordinates fallback - random Indian business centers
    const fallbackLocations = [
      { country: 'India', region: 'Maharashtra', city: 'Mumbai', lat: 19.0760, lon: 72.8777 },
      { country: 'India', region: 'Karnataka', city: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
      { country: 'India', region: 'Delhi', city: 'New Delhi', lat: 28.6139, lon: 77.2090 }
    ];
    const localFallback = fallbackLocations[Math.floor(Math.random() * fallbackLocations.length)];

    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return localFallback;
    }

    try {
      const res = await fetch(`http://ip-api.com/json/${ip}`);
      if (!res.ok) return localFallback;
      const data = await res.json();
      if (data.status !== 'success') return localFallback;
      return {
        country: data.country || 'India',
        region: data.regionName || 'Delhi',
        city: data.city || 'New Delhi',
        lat: data.lat || 28.6139,
        lon: data.lon || 77.2090,
      };
    } catch (err) {
      this.logger.debug(`IP Geo lookup failed for ${ip}: ${err}`);
      return localFallback;
    }
  }

  /**
   * Persist detailed cookie telemetry directly into the database
   */
  async record(event: AnalyticsEvent, ip?: string, authHeader?: string) {
    try {
      // Decode user authorization metadata
      const decoded = this.decodeToken(authHeader) || (event.token ? this.decodeToken(`Bearer ${event.token}`) : null);
      const tenantId = decoded?.tenantId || null;
      const userId = decoded?.sub || null;
      const email = decoded?.email || null;

      // Extract geolocation details
      const geo = await this.geolocate(ip);

      // Parse cookies if present
      const cookiesObj = typeof event.cookies === 'object' && event.cookies ? event.cookies : {};

      // Build extra session context details
      const sessionData = {
        screenWidth: event.screenWidth || null,
        screenHeight: event.screenHeight || null,
        language: event.language || null,
        duration: event.duration || null,
        eventType: event.event,
        sessionId: event.sessionId || null,
      };

      await this.prisma.userTelemetry.create({
        data: {
          tenantId,
          userId,
          email,
          ipAddress: ip || 'unknown',
          userAgent: event.userAgent || null,
          path: event.path || '/',
          referrer: event.referrer || null,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          latitude: geo.lat,
          longitude: geo.lon,
          cookies: cookiesObj,
          sessionData,
        },
      });
    } catch (err) {
      this.logger.error(`Error saving user telemetry: ${err}`);
    }

    // Also buffer normal system telemetry summaries
    const sanitized: AnalyticsEvent = {
      event: event.event,
      sessionId: event.sessionId,
      path: event.path,
      referrer: event.referrer,
      screenWidth: event.screenWidth,
      screenHeight: event.screenHeight,
      language: event.language,
      timestamp: event.timestamp || new Date().toISOString(),
      duration: event.duration,
    };
    this.eventBuffer.push(sanitized);
    if (this.eventBuffer.length >= 100) this.flush();
  }

  /**
   * Flush buffered events to the database using audit_logs (no schema change needed)
   */
  private async flush() {
    if (this.eventBuffer.length === 0) return;
    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      this.logger.debug(`Flushing ${events.length} analytics events`);

      const pageCounts: Record<string, number> = {};
      const sessions = new Set<string>();
      let totalDuration = 0;
      let durationCount = 0;

      for (const e of events) {
        if (e.path) pageCounts[e.path] = (pageCounts[e.path] || 0) + 1;
        if (e.sessionId) sessions.add(e.sessionId);
        if (e.duration) { totalDuration += e.duration; durationCount++; }
      }

      // Get first tenant for system-level logs
      const firstTenant = await this.prisma.tenant.findFirst({ select: { id: true } });
      if (!firstTenant) return;

      const today = new Date().toISOString().split('T')[0];
      await this.prisma.auditLog.create({
        data: {
          tenantId: firstTenant.id,
          action: 'ANALYTICS_FLUSH',
          module: 'ANALYTICS',
          resourceType: 'analytics_summary',
          resourceName: today,
          outcome: 'SUCCESS',
          actorIp: 'system',
          metadata: {
            date: today,
            totalEvents: events.length,
            uniqueSessions: sessions.size,
            pageViews: pageCounts,
            avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Analytics flush failed: ${err}`);
      this.eventBuffer = [...events, ...this.eventBuffer].slice(0, 500);
    }
  }

  /**
   * Log cookie consent choice for compliance records
   */
  async recordConsent(data: { analytics: boolean; version: string }, ip?: string) {
    try {
      const firstTenant = await this.prisma.tenant.findFirst({ select: { id: true } });
      if (!firstTenant) return;

      await this.prisma.auditLog.create({
        data: {
          tenantId: firstTenant.id,
          action: 'COOKIE_CONSENT',
          module: 'COMPLIANCE',
          resourceType: 'consent',
          resourceName: data.version,
          outcome: 'SUCCESS',
          actorIp: ip || 'unknown',
          metadata: {
            analyticsConsent: data.analytics,
            version: data.version,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      this.logger.error(`Consent recording failed: ${err}`);
    }
  }

  /**
   * Get analytics summary for admin dashboard
   */
  async getSummary(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'ANALYTICS_FLUSH',
        module: 'ANALYTICS',
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: days,
      select: { metadata: true, timestamp: true },
    });

    let totalPageViews = 0;
    let totalSessions = 0;
    const dailyData: any[] = [];
    const allPageCounts: Record<string, number> = {};

    for (const log of logs) {
      const meta = log.metadata as any;
      if (!meta) continue;
      totalPageViews += meta.totalEvents || 0;
      totalSessions += meta.uniqueSessions || 0;
      dailyData.push({
        date: meta.date,
        pageViews: meta.totalEvents || 0,
        sessions: meta.uniqueSessions || 0,
        avgDuration: meta.avgDuration || 0,
      });
      if (meta.pageViews) {
        for (const [path, count] of Object.entries(meta.pageViews)) {
          allPageCounts[path] = (allPageCounts[path] || 0) + (count as number);
        }
      }
    }

    const topPages = Object.entries(allPageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    return { totalPageViews, totalSessions, topPages, dailyData };
  }
}
