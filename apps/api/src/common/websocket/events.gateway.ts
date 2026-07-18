import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventBusService, DomainEvent } from '../events/event-bus.service';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
      : ['http://localhost:3000', 'http://localhost:3100', 'https://qsasset.com', 'https://www.qsasset.com', 'https://qsasset.vercel.app'],
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClients = new Map<string, { tenantId: string; userId: string; email: string }>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventBus: EventBusService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('🔌 WebSocket Gateway initialized on /realtime');

    // Bridge ALL domain events to WebSocket rooms
    this.eventBus.on('*', (event: DomainEvent) => {
      // Send as generic domain_event envelope (for the useRealtimeEvents dispatcher)
      this.broadcastToTenant(event.tenantId, 'domain_event', {
        type: event.type,
        payload: event.payload,
        timestamp: event.timestamp,
      });

      // Also forward specific events as dedicated socket events
      // (the frontend listens for these directly, not just inside domain_event)
      if (event.type === 'discovery.scan_progress') {
        this.broadcastToTenant(event.tenantId, 'scan_progress', {
          scanId: event.payload.scanJobId,
          progress: event.payload.progress,
          phase: event.payload.phase,
          found: event.payload.found,
          status: event.payload.status,
        });
      }

      if (event.type.startsWith('monitoring.device_')) {
        this.broadcastToTenant(event.tenantId, 'device_status', {
          deviceId: event.payload.deviceId,
          name: event.payload.name,
          status: event.type.includes('down') ? 'OFFLINE' : 'ONLINE',
          timestamp: event.timestamp,
        });
      }

      if (event.type === 'discovery.agent_heartbeat') {
        this.broadcastToTenant(event.tenantId, 'agent_heartbeat', {
          agentId: event.payload.agentId,
          hostname: event.payload.hostname,
          status: event.payload.status,
          timestamp: event.timestamp,
        });
      }
    });

    // Emit dashboard stats every 30 seconds to all connected rooms
    setInterval(() => {
      this.server?.emit('heartbeat', { serverTime: new Date().toISOString() });
    }, 30000);
  }

  async handleConnection(client: Socket) {
    try {
      // Prefer auth handshake / Authorization header — avoid tokens in query strings
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.emit('auth_error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET missing — rejecting WebSocket connection');
        client.emit('auth_error', { message: 'Server misconfigured' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, { secret });

      // Mirror HTTP JwtStrategy: reject inactive / deleted users
      let user;
      if (payload.sub === 'agent-session') {
        user = await this.prisma.user.findFirst({
          where: { email: payload.email, tenantId: payload.tenantId, deletedAt: null },
        });
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(payload.sub)) {
          client.emit('auth_error', { message: 'Invalid token' });
          client.disconnect();
          return;
        }
        user = await this.prisma.user.findFirst({
          where: { id: payload.sub, deletedAt: null },
        });
      }
      if (!user || user.status !== 'ACTIVE') {
        client.emit('auth_error', { message: 'User is not active' });
        client.disconnect();
        return;
      }

      const tenantId = user.tenantId;
      const userId = user.id;
      const email = user.email;

      // Join tenant-specific room
      client.join(`tenant:${tenantId}`);
      client.join(`user:${userId}`);

      this.connectedClients.set(client.id, { tenantId, userId, email });

      this.logger.log(
        `✅ Client connected: ${email} (tenant: ${tenantId.substring(0, 8)}...) | Total: ${this.connectedClients.size}`,
      );

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to QS Asset real-time feed',
        clientId: client.id,
        tenantId,
        connectedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Client ${client.id} rejected: ${err.message}`);
      client.emit('auth_error', { message: 'Invalid or expired token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const info = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);
    if (info) {
      this.logger.log(
        `❌ Client disconnected: ${info.email} | Remaining: ${this.connectedClients.size}`,
      );
    }
  }

  // ─── Broadcast Helpers ──────────────────────────────────────

  /** Send event to all clients in a tenant room */
  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.server?.to(`tenant:${tenantId}`).emit(event, data);
  }

  /** Send event to a specific user */
  sendToUser(userId: string, event: string, data: any) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  /** Send a notification to a specific user in real-time */
  pushNotification(userId: string, notification: any) {
    this.sendToUser(userId, 'notification', notification);
  }

  /** Broadcast scan progress to tenant */
  pushScanProgress(tenantId: string, progress: any) {
    this.broadcastToTenant(tenantId, 'scan_progress', progress);
  }

  /** Push device status change */
  pushDeviceStatus(tenantId: string, deviceId: string, status: string, name: string) {
    this.broadcastToTenant(tenantId, 'device_status', { deviceId, status, name, timestamp: new Date().toISOString() });
  }

  /** Push agent heartbeat */
  pushAgentHeartbeat(tenantId: string, agentId: string, hostname: string, status: string) {
    this.broadcastToTenant(tenantId, 'agent_heartbeat', { agentId, hostname, status, timestamp: new Date().toISOString() });
  }

  /** Get connection stats */
  getStats() {
    const tenants = new Set<string>();
    this.connectedClients.forEach((v) => tenants.add(v.tenantId));
    return {
      totalConnections: this.connectedClients.size,
      uniqueTenants: tenants.size,
      clients: Array.from(this.connectedClients.entries()).map(([id, info]) => ({
        clientId: id,
        email: info.email,
        tenantId: info.tenantId.substring(0, 8) + '...',
      })),
    };
  }
}
