import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async getVehicles(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, latitude: { not: null } },
      include: {
        assetType: { select: { name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        site: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    const active = assets.filter(a => a.status === 'ACTIVE').length;
    const maintenance = assets.filter(a => a.status === 'IN_MAINTENANCE').length;
    const maintenanceDue = await this.getMaintenanceDue(tenantId);
    return {
      data: assets,
      total: assets.length,
      active,
      inMaintenance: maintenance,
      gpsTracked: assets.length,
      maintenanceDueCount: maintenanceDue.total,
    };
  }

  /** Fleet vehicle PM due from EAM MaintenanceSchedule (next 14 days + overdue). */
  async getMaintenanceDue(tenantId: string) {
    const now = new Date();
    const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const vehicleIds = (
      await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, latitude: { not: null } },
        select: { id: true },
      })
    ).map((a) => a.id);

    if (vehicleIds.length === 0) {
      return { total: 0, overdue: 0, upcoming: 0, items: [] };
    }

    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        tenantId,
        isActive: true,
        assetId: { in: vehicleIds },
        nextDueAt: { not: null, lte: in14d },
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
      },
      orderBy: { nextDueAt: 'asc' },
      take: 100,
    });

    const items = schedules.map((s) => ({
      id: s.id,
      assetId: s.assetId,
      assetName: s.asset?.name,
      assetTag: s.asset?.assetTag,
      title: s.name,
      nextDueAt: s.nextDueAt,
      overdue: s.nextDueAt ? s.nextDueAt <= now : false,
    }));

    return {
      total: items.length,
      overdue: items.filter((i) => i.overdue).length,
      upcoming: items.filter((i) => !i.overdue).length,
      items,
    };
  }

  async getGeofences(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    return settings.geofences || [];
  }

  async createGeofence(tenantId: string, body: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    const geofences = settings.geofences || [];
    const newFence = { id: Date.now().toString(), ...body, createdAt: new Date() };
    geofences.push(newFence);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, geofences } },
    });
    return newFence;
  }

  async getAlerts(tenantId: string) {
    const [alertEvents, notifications] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where: { tenantId, category: { in: ['fleet', 'FLEET', 'geofence', 'speeding', 'idle'] } },
        take: 40,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { tenantId, type: 'ALERT', module: 'fleet' },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const fromEvents = alertEvents.map((e) => ({
      id: e.id,
      title: e.title,
      message: e.message,
      type: 'ALERT',
      severity: e.severity,
      category: e.category,
      source: e.source,
      sourceId: e.sourceId,
      acknowledged: e.acknowledged,
      resolved: e.resolved,
      createdAt: e.createdAt,
      metadata: e.metadata,
    }));

    // Prefer AlertEvent feed; fall back to notifications for older installs
    if (fromEvents.length > 0) return fromEvents;

    return notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      severity: 'WARNING',
      category: 'fleet',
      source: 'notification',
      sourceId: n.resourceId,
      acknowledged: n.isRead,
      resolved: false,
      createdAt: n.createdAt,
      metadata: {},
    }));
  }

  async getTripHistory(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.asset.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
    });
    if (!vehicle) return { trips: [] };

    const dbTrips = await this.prisma.trip.findMany({
      where: { tenantId, assetId: vehicleId },
      orderBy: { startTime: 'desc' },
    });

    if (dbTrips && dbTrips.length > 0) {
      return {
        vehicleId,
        vehicleName: vehicle.name,
        trips: dbTrips.map(t => ({
          id: t.id,
          vehicleId: t.assetId,
          startTime: t.startTime,
          endTime: t.endTime,
          distanceKm: t.distanceKm,
          maxSpeed: t.maxSpeed,
          avgSpeed: t.avgSpeed,
          startLocation: t.startLocation,
          endLocation: t.endLocation,
          points: t.routeCoords || [],
        })),
      };
    }

    return { trips: [], message: 'No trip data available. Connect a GPS telematics provider to see real trip history.' };
  }

  async getLivePosition(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.asset.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
    });
    if (!vehicle) return null;

    // Fetch last 2 GPS points to calculate heading from bearing
    const recentTelemetry = await this.prisma.gpsTelemetry.findMany({
      where: { tenantId, assetId: vehicleId },
      orderBy: { collectedAt: 'desc' },
      take: 2,
    });

    const latestTelemetry = recentTelemetry[0] || null;
    const previousTelemetry = recentTelemetry[1] || null;

    const lat = latestTelemetry ? latestTelemetry.latitude : vehicle.latitude;
    const lng = latestTelemetry ? latestTelemetry.longitude : vehicle.longitude;
    const speed = latestTelemetry ? latestTelemetry.speed : 0;
    const fuelLevel = latestTelemetry ? latestTelemetry.fuelLevel : null;
    const lastUpdated = latestTelemetry ? latestTelemetry.collectedAt : (vehicle.updatedAt || new Date());
    const isStale = (Date.now() - new Date(lastUpdated).getTime()) > 3600 * 1000; // >1 hour old

    // Calculate heading from last 2 GPS points using geodesic bearing formula
    let heading = 0;
    if (latestTelemetry && previousTelemetry) {
      heading = this.calculateBearing(
        previousTelemetry.latitude, previousTelemetry.longitude,
        latestTelemetry.latitude, latestTelemetry.longitude,
      );
    }

    // Derive ignition from speed when telemetry is available (more meaningful than status)
    const ignition = latestTelemetry
      ? (speed > 0 ? 'ON' : 'OFF')
      : (vehicle.status === 'ACTIVE' ? 'ON' : 'OFF');

    return {
      vehicleId,
      vehicleName: vehicle.name,
      latitude: lat,
      longitude: lng,
      speed,
      heading,
      status: vehicle.status,
      lastUpdated: new Date(lastUpdated).toISOString(),
      ignition,
      fuelLevel,
      stale: isStale,
    };
  }

  /**
   * Calculate bearing (heading) in degrees between two GPS coordinates.
   * Returns value normalized to 0-360°.
   */
  private calculateBearing(lat1Deg: number, lng1Deg: number, lat2Deg: number, lng2Deg: number): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const lat1 = toRad(lat1Deg);
    const lat2 = toRad(lat2Deg);
    const dLng = toRad(lng2Deg - lng1Deg);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearingRad = Math.atan2(y, x);
    const bearingDeg = bearingRad * 180 / Math.PI;

    // Normalize to 0-360°
    return (bearingDeg + 360) % 360;
  }

  // ─── GPS TELEMETRY INGESTION ──────────────────────────────────────────
  /**
   * Ingest GPS telemetry data from a telematics provider or IoT device.
   * Also updates the asset's cached lat/lng and checks geofences.
   */
  async ingestTelemetry(tenantId: string, data: {
    assetId: string; latitude: number; longitude: number;
    speed?: number; fuelLevel?: number;
  }) {
    // 1. Create telemetry record
    const telemetry = await this.prisma.gpsTelemetry.create({
      data: {
        tenantId,
        assetId: data.assetId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed || 0,
        fuelLevel: data.fuelLevel,
      },
    });

    // 2. Update cached coordinates on the asset
    await this.prisma.asset.update({
      where: { id: data.assetId },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    // 3. Check geofence violations
    await this.checkGeofences(tenantId, data.assetId, data.latitude, data.longitude);

    // 4. Speeding + idle alerts
    await this.checkSpeedAndIdle(tenantId, data.assetId, data.speed || 0);

    return telemetry;
  }

  /**
   * Speeding and idle detection based on tenant fleet settings.
   * settings.fleet.maxSpeedKmh (default 120), settings.fleet.idleMinutes (default 15)
   */
  async checkSpeedAndIdle(tenantId: string, vehicleId: string, speed: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    const fleetCfg = settings.fleet || {};
    const maxSpeed = Number(fleetCfg.maxSpeedKmh) || 120;
    const idleMinutes = Number(fleetCfg.idleMinutes) || 15;

    const vehicle = await this.prisma.asset.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vehicle) return;

    if (speed > maxSpeed) {
      await this.broadcastFleetAlert(tenantId, {
        vehicleId,
        vehicleName: vehicle.name,
        alertType: 'SPEEDING',
        title: `Speeding: ${vehicle.name}`,
        message: `Vehicle "${vehicle.name}" is traveling at ${speed.toFixed(1)} km/h (limit ${maxSpeed} km/h).`,
        meta: { speed, maxSpeed },
      });
      this.eventBus.emitAssetEvent(tenantId, 'fleet.speeding', {
        vehicleId,
        vehicleName: vehicle.name,
        speed,
        maxSpeed,
        timestamp: new Date(),
      });
    }

    // Idle: speed ≈ 0 for idleMinutes based on recent telemetry
    if (speed <= 1) {
      const since = new Date(Date.now() - idleMinutes * 60 * 1000);
      const recent = await this.prisma.gpsTelemetry.findMany({
        where: { tenantId, assetId: vehicleId, collectedAt: { gte: since } },
        orderBy: { collectedAt: 'asc' },
        select: { speed: true, collectedAt: true },
      });
      if (recent.length >= 3 && recent.every((r) => (r.speed || 0) <= 1)) {
        const first = recent[0].collectedAt;
        const idleForMin = (Date.now() - new Date(first).getTime()) / 60000;
        if (idleForMin >= idleMinutes) {
          // Dedup: only alert if no idle alert in last idleMinutes
          const recentAlert = await this.prisma.notification.findFirst({
            where: {
              tenantId,
              resourceId: vehicleId,
              module: 'fleet',
              title: { startsWith: 'Idle:' },
              createdAt: { gte: since },
            },
          });
          if (!recentAlert) {
            await this.broadcastFleetAlert(tenantId, {
              vehicleId,
              vehicleName: vehicle.name,
              alertType: 'IDLE',
              title: `Idle: ${vehicle.name}`,
              message: `Vehicle "${vehicle.name}" has been idle for ~${Math.round(idleForMin)} minutes.`,
              meta: { idleMinutes: Math.round(idleForMin) },
            });
            this.eventBus.emitAssetEvent(tenantId, 'fleet.idle', {
              vehicleId,
              vehicleName: vehicle.name,
              idleMinutes: Math.round(idleForMin),
              timestamp: new Date(),
            });
          }
        }
      }
    }
  }

  private async broadcastFleetAlert(
    tenantId: string,
    data: {
      vehicleId: string;
      vehicleName: string;
      alertType: string;
      title: string;
      message: string;
      meta?: any;
    },
  ) {
    const severity =
      data.alertType === 'SPEEDING' ? 'HIGH' : data.alertType === 'IDLE' ? 'MEDIUM' : 'WARNING';
    const category =
      data.alertType === 'SPEEDING' ? 'speeding' : data.alertType === 'IDLE' ? 'idle' : 'fleet';

    // Dedup AlertEvent within 15 minutes for same vehicle + type
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const existing = await this.prisma.alertEvent.findFirst({
      where: {
        tenantId,
        sourceId: data.vehicleId,
        category,
        title: data.title,
        createdAt: { gte: since },
      },
    });
    if (!existing) {
      await this.prisma.alertEvent.create({
        data: {
          tenantId,
          severity,
          category,
          title: data.title,
          message: data.message,
          source: 'fleet',
          sourceId: data.vehicleId,
          metadata: { alertType: data.alertType, vehicleName: data.vehicleName, ...(data.meta || {}) },
        },
      });
    }

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Tenant Admin', 'Fleet Manager'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        tenantId,
        userId: admin.id,
        title: data.title,
        message: data.message,
        type: 'ALERT',
        module: 'fleet',
        resourceId: data.vehicleId,
      })),
    });
  }

  /**
   * Traccar / OsmAnd webhook ingest.
   * Traccar: { uniqueId|deviceId, latitude, longitude, speed, attributes? }
   * OsmAnd: query/body lat, lon, speed, deviceid|id, timestamp
   */
  async ingestTraccarOrOsmand(
    tenantId: string,
    body: any,
    query: any = {},
  ) {
    const src = { ...query, ...body };
    const lat = parseFloat(src.latitude ?? src.lat ?? src.y);
    const lng = parseFloat(src.longitude ?? src.lon ?? src.lng ?? src.x);
    const speedRaw = src.speed ?? src.speedKmh ?? src.spd ?? 0;
    let speed = parseFloat(speedRaw) || 0;
    // Traccar often reports speed in knots or m/s — if attributes.speed present use km/h hint
    if (src.speedUnit === 'knots' || (body?.protocol === 'osmand' && speed < 50 && src.speed)) {
      // OsmAnd speed is often m/s
      if (String(src.protocol || '').toLowerCase() === 'osmand' || query.protocol === 'osmand') {
        speed = speed * 3.6;
      }
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { error: 'latitude/longitude required' };
    }

    const deviceKey = String(
      src.uniqueId ||
        src.deviceId ||
        src.deviceid ||
        src.id ||
        src.assetId ||
        src.imei ||
        '',
    );
    if (!deviceKey) return { error: 'device identifier required' };

    // Map device key → asset via settings.fleet.traccarDeviceMap or assetTag/hostname/id
    const settings = ((await this.prisma.tenant.findUnique({ where: { id: tenantId } }))
      ?.settings as any) || {};
    const map: Record<string, string> = settings.fleet?.traccarDeviceMap || {};
    let assetId = map[deviceKey] || null;

    if (!assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { id: deviceKey },
            { assetTag: deviceKey },
            { hostname: deviceKey },
            { serialNumber: deviceKey },
          ],
        },
        select: { id: true },
      });
      assetId = asset?.id || null;
    }

    if (!assetId) {
      return { error: `No asset mapped for device ${deviceKey}`, deviceKey };
    }

    const fuelLevel =
      src.fuel != null
        ? parseFloat(src.fuel)
        : src.attributes?.fuel != null
          ? parseFloat(src.attributes.fuel)
          : undefined;

    const telemetry = await this.ingestTelemetry(tenantId, {
      assetId,
      latitude: lat,
      longitude: lng,
      speed,
      fuelLevel: Number.isNaN(fuelLevel as number) ? undefined : fuelLevel,
    });

    return { ok: true, assetId, telemetryId: telemetry.id, speed };
  }

  // ─── GEOFENCE VIOLATION DETECTION ─────────────────────────────────────
  /**
   * Check if a vehicle is inside or outside all defined geofences.
   * Uses ray-casting point-in-polygon algorithm for polygon geofences
   * and Haversine distance for circular geofences.
   * Detects boundary transitions (enter/exit) and creates notifications.
   */
  async checkGeofences(
    tenantId: string,
    vehicleId: string,
    lat: number,
    lng: number,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    const geofences: any[] = settings.geofences || [];

    if (geofences.length === 0) return;

    const vehicle = await this.prisma.asset.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vehicle) return;

    for (const fence of geofences) {
      const fenceId = fence.id;
      let isInside = false;

      if (fence.type === 'circle' && fence.center && fence.radius) {
        // Circular geofence — use Haversine distance
        const distanceMeters = this.haversineDistance(
          lat, lng,
          fence.center.lat ?? fence.center[0],
          fence.center.lng ?? fence.center[1],
        );
        isInside = distanceMeters <= fence.radius;
      } else if (fence.coordinates && Array.isArray(fence.coordinates) && fence.coordinates.length >= 3) {
        // Polygon geofence — use ray-casting algorithm
        isInside = this.pointInPolygon(lat, lng, fence.coordinates);
      } else {
        continue; // Unknown geofence type, skip
      }

      // Check for state transition using stored vehicle states in geofence settings
      const vehicleStates = fence.vehicleStates || {};
      const previousState = vehicleStates[vehicleId]; // true = was inside, false = was outside, undefined = first check
      const stateChanged = previousState !== undefined && previousState !== isInside;

      // Update the vehicle's in/out state for this geofence
      if (!fence.vehicleStates) fence.vehicleStates = {};
      fence.vehicleStates[vehicleId] = isInside;

      // Only fire events on state transitions, not on every position update
      if (stateChanged) {
        const eventType = isInside ? 'ENTERED' : 'EXITED';
        const fenceName = fence.name || `Geofence ${fenceId}`;

        this.logger.warn(
          `Geofence ${eventType}: Vehicle ${vehicle.name} (${vehicleId}) ` +
          `${eventType.toLowerCase()} "${fenceName}" at [${lat}, ${lng}]`,
        );

        // Create notification for admins
        await this.broadcastGeofenceAlert(tenantId, {
          vehicleId,
          vehicleName: vehicle.name,
          geofenceId: fenceId,
          geofenceName: fenceName,
          eventType,
          latitude: lat,
          longitude: lng,
          timestamp: new Date(),
        });

        // Emit event for automation engine
        this.eventBus.emitAssetEvent(tenantId, 'fleet.geofence_breach', {
          vehicleId,
          vehicleName: vehicle.name,
          geofenceId: fenceId,
          geofenceName: fenceName,
          eventType,
          latitude: lat,
          longitude: lng,
          timestamp: new Date(),
        });
      }
    }

    // Persist updated vehicle states back to tenant settings
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, geofences } },
    });
  }

  /**
   * Ray-casting point-in-polygon algorithm.
   * Determines if a point (lat, lng) is inside a polygon defined by an array of coordinates.
   * Each coordinate can be { lat, lng } or [lat, lng].
   */
  private pointInPolygon(lat: number, lng: number, polygon: any[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].lat ?? polygon[i][0];
      const yi = polygon[i].lng ?? polygon[i][1];
      const xj = polygon[j].lat ?? polygon[j][0];
      const yj = polygon[j].lng ?? polygon[j][1];

      const intersect =
        yi > lng !== yj > lng &&
        lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Haversine distance between two lat/lng points, in meters.
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Send geofence violation notification to all Fleet Manager and Admin users.
   */
  private async broadcastGeofenceAlert(
    tenantId: string,
    data: {
      vehicleId: string; vehicleName: string; geofenceId: string;
      geofenceName: string; eventType: string; latitude: number;
      longitude: number; timestamp: Date;
    },
  ) {
    const title = `Geofence ${data.eventType}: ${data.vehicleName}`;
    const message = `Vehicle "${data.vehicleName}" has ${data.eventType.toLowerCase()} ` +
      `geofence "${data.geofenceName}" at coordinates [${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}].`;

    await this.prisma.alertEvent.create({
      data: {
        tenantId,
        severity: data.eventType === 'EXITED' ? 'HIGH' : 'MEDIUM',
        category: 'geofence',
        title,
        message,
        source: 'fleet',
        sourceId: data.vehicleId,
        metadata: {
          geofenceId: data.geofenceId,
          geofenceName: data.geofenceName,
          eventType: data.eventType,
          latitude: data.latitude,
          longitude: data.longitude,
          vehicleName: data.vehicleName,
        },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Tenant Admin', 'Fleet Manager'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (admins.length === 0) return;

    await this.prisma.notification.createMany({
      data: admins.map(admin => ({
        tenantId,
        userId: admin.id,
        title,
        message,
        type: 'ALERT',
        module: 'fleet',
        resourceId: data.vehicleId,
      })),
    });
  }
}
