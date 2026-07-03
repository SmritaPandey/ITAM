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

@WebSocketGateway({
  cors: {
    origin: '*',
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
      // Extract JWT from auth handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token`);
        client.emit('auth_error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get('JWT_SECRET', 'supersecret'),
      });

      const tenantId = payload.tenantId;
      const userId = payload.sub;
      const email = payload.email;

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
