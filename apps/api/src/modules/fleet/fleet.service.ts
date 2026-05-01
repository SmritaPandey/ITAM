import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class FleetService {
  constructor(private prisma: PrismaService) {}

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
    // Geofences stored in tenant settings or as JSON — simplified approach
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
    // Return recent notifications of type 'fleet'
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

    // Simulated trip data — in production, fetched from GPS telematics device
    const baseLat = vehicle.latitude || 28.6139;
    const baseLng = vehicle.longitude || 77.2090;
    const trips = [];
    for (let i = 0; i < 5; i++) {
      const startTime = new Date(Date.now() - (i + 1) * 24 * 3600 * 1000);
      const endTime = new Date(startTime.getTime() + (2 + Math.random() * 4) * 3600 * 1000);
      const points = [];
      const numPoints = 10 + Math.floor(Math.random() * 20);
      for (let j = 0; j < numPoints; j++) {
        points.push({
          lat: baseLat + (Math.random() - 0.5) * 0.1,
          lng: baseLng + (Math.random() - 0.5) * 0.1,
          speed: Math.floor(20 + Math.random() * 60),
          timestamp: new Date(startTime.getTime() + j * ((endTime.getTime() - startTime.getTime()) / numPoints)),
        });
      }
      trips.push({
        id: `trip-${vehicleId}-${i}`,
        vehicleId,
        startTime, endTime,
        distanceKm: Math.round((5 + Math.random() * 50) * 10) / 10,
        maxSpeed: Math.max(...points.map(p => p.speed)),
        avgSpeed: Math.round(points.reduce((s, p) => s + p.speed, 0) / points.length),
        points,
      });
    }
    return { vehicleId, vehicleName: vehicle.name, trips };
  }

  async getLivePosition(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.asset.findFirst({
      where: { id: vehicleId, tenantId, deletedAt: null },
    });
    if (!vehicle) return null;

    // In production, this would query real-time GPS feed
    return {
      vehicleId,
      vehicleName: vehicle.name,
      latitude: vehicle.latitude ? vehicle.latitude + (Math.random() - 0.5) * 0.001 : null,
      longitude: vehicle.longitude ? vehicle.longitude + (Math.random() - 0.5) * 0.001 : null,
      speed: Math.floor(Math.random() * 80),
      heading: Math.floor(Math.random() * 360),
      status: vehicle.status,
      lastUpdated: new Date().toISOString(),
      ignition: Math.random() > 0.3 ? 'ON' : 'OFF',
      fuelLevel: Math.floor(30 + Math.random() * 70),
    };
  }
}
