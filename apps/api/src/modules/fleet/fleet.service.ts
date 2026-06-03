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
    return {
      data: assets,
      total: assets.length,
      active,
      inMaintenance: maintenance,
      gpsTracked: assets.length,
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
    return this.prisma.notification.findMany({
      where: { user: { tenantId }, type: 'ALERT' },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
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

    return telemetry;
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
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Tenant Admin', 'Fleet Manager'] } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const title = `Geofence ${data.eventType}: ${data.vehicleName}`;
    const message = `Vehicle "${data.vehicleName}" has ${data.eventType.toLowerCase()} ` +
      `geofence "${data.geofenceName}" at coordinates [${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}].`;

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
