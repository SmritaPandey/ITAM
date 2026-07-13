import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/database/prisma.service';

const execFileAsync = promisify(execFile);
const HLS_ROOT = '/tmp/qs-hls';

export interface HlsStartResult {
  streamingAvailable: boolean;
  reason?: string;
  playlistUrl?: string;
  cameraId?: string;
}

@Injectable()
export class CameraHlsService implements OnModuleDestroy {
  private readonly logger = new Logger(CameraHlsService.name);
  private readonly processes = new Map<string, ChildProcess>();
  private ffmpegPath: string | null | undefined;

  constructor(private prisma: PrismaService) {}

  onModuleDestroy() {
    for (const [id, proc] of this.processes) {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      this.processes.delete(id);
    }
  }

  async isFfmpegAvailable(): Promise<{ available: boolean; path?: string; reason?: string }> {
    const bin = await this.findFfmpeg();
    if (!bin) {
      return {
        available: false,
        reason: 'ffmpeg not found on PATH. Install ffmpeg to enable RTSP→HLS live streaming.',
      };
    }
    return { available: true, path: bin };
  }

  /**
   * Start (or reuse) an ffmpeg RTSP→HLS process for a camera.
   * Never fakes video — returns streamingAvailable:false when ffmpeg is missing.
   */
  async startHls(cameraId: string, tenantId: string): Promise<HlsStartResult> {
    const camera = await this.prisma.monitoredDevice.findFirst({
      where: { id: cameraId, tenantId, type: 'CAMERA' },
    });
    if (!camera) throw new NotFoundException('Camera not found');

    const ffmpeg = await this.findFfmpeg();
    if (!ffmpeg) {
      return {
        streamingAvailable: false,
        reason: 'ffmpeg not found on PATH. Install ffmpeg on the API host to enable live RTSP→HLS streaming. Cameras remain available as inventory only.',
        cameraId,
      };
    }

    const config = (camera.config as any) || {};
    const rtspUrl =
      config.rtspUrl ||
      config.streamUrl ||
      (camera.ipAddress ? `rtsp://${camera.ipAddress}:554/stream1` : null);

    if (!rtspUrl || !String(rtspUrl).startsWith('rtsp://')) {
      return {
        streamingAvailable: false,
        reason: 'Camera has no RTSP URL configured. Add an rtsp:// URL in the camera settings.',
        cameraId,
      };
    }

    const outDir = path.join(HLS_ROOT, cameraId);
    fs.mkdirSync(outDir, { recursive: true });
    const playlistPath = path.join(outDir, 'index.m3u8');

    // Reuse existing healthy process
    const existing = this.processes.get(cameraId);
    if (existing && !existing.killed && existing.exitCode === null) {
      if (fs.existsSync(playlistPath)) {
        return {
          streamingAvailable: true,
          playlistUrl: `/api/v1/monitoring/cameras/${cameraId}/hls/index.m3u8`,
          cameraId,
        };
      }
    } else if (existing) {
      this.stopProcess(cameraId);
    }

    // Clear stale segments
    try {
      for (const f of fs.readdirSync(outDir)) {
        fs.unlinkSync(path.join(outDir, f));
      }
    } catch {
      /* ignore */
    }

    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-an',
      '-c:v', 'copy',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', path.join(outDir, 'seg_%03d.ts'),
      playlistPath,
    ];

    this.logger.log(`Starting ffmpeg RTSP→HLS for camera ${cameraId}`);
    const child = spawn(ffmpeg, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: false,
    });

    child.stderr?.on('data', (buf: Buffer) => {
      const line = buf.toString().trim();
      if (line) this.logger.debug(`[ffmpeg ${cameraId}] ${line}`);
    });

    child.on('exit', (code, signal) => {
      this.logger.warn(`ffmpeg for camera ${cameraId} exited code=${code} signal=${signal}`);
      this.processes.delete(cameraId);
    });

    this.processes.set(cameraId, child);

    // Wait briefly for playlist to appear (up to ~4s)
    const ready = await this.waitForFile(playlistPath, 4000);
    if (!ready) {
      // Process may still be connecting — return URL anyway; client will retry
      this.logger.warn(`HLS playlist not yet ready for ${cameraId}; returning URL for client retry`);
    }

    return {
      streamingAvailable: true,
      playlistUrl: `/api/v1/monitoring/cameras/${cameraId}/hls/index.m3u8`,
      cameraId,
    };
  }

  async stopHls(cameraId: string, tenantId: string): Promise<{ stopped: boolean }> {
    const camera = await this.prisma.monitoredDevice.findFirst({
      where: { id: cameraId, tenantId, type: 'CAMERA' },
    });
    if (!camera) throw new NotFoundException('Camera not found');
    this.stopProcess(cameraId);
    return { stopped: true };
  }

  /**
   * Resolve a safe path under /tmp/qs-hls/:cameraId/ for serving segments.
   */
  resolveHlsFile(cameraId: string, filename: string): string | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
    if (filename.includes('..')) return null;
    const full = path.join(HLS_ROOT, cameraId, filename);
    const resolved = path.resolve(full);
    const root = path.resolve(path.join(HLS_ROOT, cameraId));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
    if (!fs.existsSync(resolved)) return null;
    return resolved;
  }

  private stopProcess(cameraId: string) {
    const proc = this.processes.get(cameraId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      this.processes.delete(cameraId);
    }
  }

  private async findFfmpeg(): Promise<string | null> {
    if (this.ffmpegPath !== undefined) return this.ffmpegPath;
    try {
      if (process.platform === 'win32') {
        await execFileAsync('where.exe', ['ffmpeg'], { timeout: 5000 });
        this.ffmpegPath = 'ffmpeg';
      } else {
        const { stdout } = await execFileAsync('which', ['ffmpeg'], { timeout: 5000 });
        this.ffmpegPath = (stdout || '').trim() || 'ffmpeg';
      }
    } catch {
      const abs = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];
      this.ffmpegPath = abs.find((p) => fs.existsSync(p)) || null;
    }
    return this.ffmpegPath;
  }

  private waitForFile(filePath: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (fs.existsSync(filePath)) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(tick, 200);
      };
      tick();
    });
  }
}
