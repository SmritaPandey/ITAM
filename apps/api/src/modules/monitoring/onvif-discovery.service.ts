import { Injectable, Logger } from '@nestjs/common';
import * as dgram from 'dgram';
import * as http from 'http';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

/**
 * Discovered ONVIF camera device info
 */
export interface OnvifDevice {
  address: string;
  port: number;
  name?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  hardwareId?: string;
  xaddrs: string;
  scopes: string[];
  profiles?: OnvifProfile[];
}

export interface OnvifProfile {
  name: string;
  token: string;
  rtspUri?: string;
  resolution?: { width: number; height: number };
  encoding?: string;
  fps?: number;
}

/**
 * WS-Discovery probe message for ONVIF devices (IEEE 802.11/DPWS)
 */
const WS_DISCOVERY_PROBE = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:__UUID__</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;

const WS_DISCOVERY_MULTICAST = '239.255.255.250';
const WS_DISCOVERY_PORT = 3702;

@Injectable()
export class OnvifDiscoveryService {
  private readonly logger = new Logger(OnvifDiscoveryService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Perform WS-Discovery probe to find ONVIF cameras on the network.
   * Sends a multicast UDP probe and collects responses for `timeoutMs`.
   */
  async discoverCameras(timeoutMs = 5000): Promise<OnvifDevice[]> {
    return new Promise((resolve) => {
      const devices: OnvifDevice[] = [];
      const seenAddrs = new Set<string>();

      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('message', (msg) => {
        try {
          const response = msg.toString();
          const device = this.parseProbeMatch(response);
          if (device && !seenAddrs.has(device.address)) {
            seenAddrs.add(device.address);
            devices.push(device);
          }
        } catch { /* Ignore non-ONVIF responses */ }
      });

      socket.on('error', (err) => {
        this.logger.warn(`WS-Discovery error: ${err.message}`);
      });

      socket.bind(() => {
        try {
          socket.setBroadcast(true);
          socket.setMulticastTTL(128);

          // Generate unique message ID
          const uuid = this.generateUuid();
          const probe = WS_DISCOVERY_PROBE.replace('__UUID__', uuid);
          const buf = Buffer.from(probe);

          socket.send(buf, 0, buf.length, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST, (err) => {
            if (err) this.logger.warn(`Failed to send WS-Discovery probe: ${err.message}`);
          });
        } catch (err: any) {
          this.logger.warn(`WS-Discovery bind error: ${err.message}`);
        }
      });

      // Collect responses for the timeout duration
      setTimeout(() => {
        try { socket.close(); } catch { /* ignore */ }
        this.logger.log(`WS-Discovery completed: ${devices.length} ONVIF cameras found`);
        resolve(devices);
      }, timeoutMs);
    });
  }

  /**
   * Parse a WS-Discovery ProbeMatch response
   */
  private parseProbeMatch(xml: string): OnvifDevice | null {
    // Extract XAddrs (the ONVIF service URL)
    const xaddrsMatch = xml.match(/<[\w:]*XAddrs[^>]*>([^<]+)/);
    if (!xaddrsMatch) return null;

    const xaddrs = xaddrsMatch[1].trim().split(/\s+/)[0]; // Take first URL
    const urlMatch = xaddrs.match(/https?:\/\/([^:/]+)(?::(\d+))?/);
    if (!urlMatch) return null;

    const address = urlMatch[1];
    const port = parseInt(urlMatch[2] || '80', 10);

    // Extract scopes
    const scopesMatch = xml.match(/<[\w:]*Scopes[^>]*>([^<]+)/);
    const scopes = scopesMatch ? scopesMatch[1].trim().split(/\s+/) : [];

    // Parse device metadata from scopes
    const name = this.extractScope(scopes, 'name');
    const manufacturer = this.extractScope(scopes, 'hardware') || this.extractScope(scopes, 'manufacturer');
    const model = this.extractScope(scopes, 'model');

    return { address, port, name, manufacturer, model, xaddrs, scopes };
  }

  /**
   * Extract a value from ONVIF scope URIs
   * Scopes are like: onvif://www.onvif.org/name/MyCamera
   */
  private extractScope(scopes: string[], key: string): string | undefined {
    for (const s of scopes) {
      const match = s.match(new RegExp(`/${key}/(.+)$`, 'i'));
      if (match) return decodeURIComponent(match[1]);
    }
    return undefined;
  }

  /**
   * Get device info via ONVIF GetDeviceInformation SOAP call
   */
  async getDeviceInfo(host: string, port = 80, username?: string, password?: string): Promise<Partial<OnvifDevice>> {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
                xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <s:Body>
        <tds:GetDeviceInformation/>
      </s:Body>
    </s:Envelope>`;

    try {
      const response = await this.soapRequest(host, port, '/onvif/device_service', soapBody, username, password);

      const manufacturer = response.match(/<[\w:]*Manufacturer[^>]*>([^<]+)/)?.[1];
      const model = response.match(/<[\w:]*Model[^>]*>([^<]+)/)?.[1];
      const firmwareVersion = response.match(/<[\w:]*FirmwareVersion[^>]*>([^<]+)/)?.[1];
      const hardwareId = response.match(/<[\w:]*HardwareId[^>]*>([^<]+)/)?.[1];

      return { manufacturer, model, firmwareVersion, hardwareId, address: host, port, xaddrs: `http://${host}:${port}/onvif/device_service`, scopes: [] };
    } catch (err: any) {
      this.logger.warn(`Failed to get ONVIF device info from ${host}:${port}: ${err.message}`);
      return { address: host, port, xaddrs: `http://${host}:${port}/onvif/device_service`, scopes: [] };
    }
  }

  /**
   * Get RTSP stream URIs via ONVIF GetStreamUri
   */
  async getStreamUri(host: string, port = 80, profileToken = 'MainProfile', username?: string, password?: string): Promise<string | null> {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
                xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
                xmlns:tt="http://www.onvif.org/ver10/schema">
      <s:Body>
        <trt:GetStreamUri>
          <trt:StreamSetup>
            <tt:Stream>RTP-Unicast</tt:Stream>
            <tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
          </trt:StreamSetup>
          <trt:ProfileToken>${profileToken}</trt:ProfileToken>
        </trt:GetStreamUri>
      </s:Body>
    </s:Envelope>`;

    try {
      const response = await this.soapRequest(host, port, '/onvif/media_service', soapBody, username, password);
      const uriMatch = response.match(/<[\w:]*Uri[^>]*>([^<]+)/);
      return uriMatch ? uriMatch[1] : null;
    } catch (err: any) {
      this.logger.warn(`Failed to get stream URI from ${host}: ${err.message}`);
      return null;
    }
  }

  /**
   * Discover cameras and auto-register them as MonitoredDevices
   */
  async discoverAndRegister(tenantId: string): Promise<{ discovered: number; registered: number; skipped: number }> {
    const cameras = await this.discoverCameras();

    let registered = 0;
    let skipped = 0;

    for (const cam of cameras) {
      // Check if already registered
      const existing = await this.prisma.monitoredDevice.findFirst({
        where: { tenantId, ipAddress: cam.address, type: 'CAMERA' },
      });

      if (existing) { skipped++; continue; }

      // Try to get detailed info
      const info = await this.getDeviceInfo(cam.address, cam.port);
      const rtspUri = await this.getStreamUri(cam.address, cam.port);

      await this.prisma.monitoredDevice.create({
        data: {
          tenantId,
          type: 'CAMERA',
          name: cam.name || info.manufacturer ? `${info.manufacturer || ''} ${info.model || ''} (${cam.address})`.trim() : cam.address,
          ipAddress: cam.address,
          status: 'ONLINE',
          lastSeen: new Date(),
          config: {
            cameraType: 'IP',
            resolution: '1080p',
            manufacturer: info.manufacturer || cam.manufacturer,
            model: info.model || cam.model,
            firmwareVersion: info.firmwareVersion,
            rtspUrl: rtspUri || `rtsp://${cam.address}:554/stream1`,
            subStreamUrl: `rtsp://${cam.address}:554/stream2`,
            snapshotUrl: `http://${cam.address}/snapshot.jpg`,
            onvifUrl: cam.xaddrs,
            ptzSupport: cam.scopes.some(s => s.includes('ptz')),
            recording: false,
            discoveredAt: new Date().toISOString(),
            discoverySource: 'onvif',
          },
          metrics: { health: 100, storage: 0 },
        },
      });
      registered++;
    }

    if (registered > 0) {
      this.eventBus.emitMonitoringEvent(tenantId, 'cameras_discovered', {
        total: cameras.length, registered, skipped,
      });
    }

    return { discovered: cameras.length, registered, skipped };
  }

  /**
   * Simple HTTP SOAP request helper
   */
  private soapRequest(host: string, port: number, path: string, body: string, username?: string, password?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body).toString(),
      };

      if (username && password) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }

      const req = http.request({ hostname: host, port, path, method: 'POST', headers, timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('ONVIF request timeout')); });
      req.write(body);
      req.end();
    });
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
