import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { isOnPrem } from '../../common/deployment-mode';
import {
  assertPlatformUpdateManifest,
  getPlatformUpdatePublicKeyPem,
  verifyPlatformManifest,
  type PlatformUpdateManifest,
} from '../../common/security/platform-update-crypto';

@Injectable()
export class PlatformUpdateService {
  private readonly logger = new Logger(PlatformUpdateService.name);

  async latest(): Promise<PlatformUpdateManifest> {
    this.assertOnPrem();
    const manifest = await this.loadManifest();
    const publicKey = getPlatformUpdatePublicKeyPem();
    if (!publicKey) {
      throw new ServiceUnavailableException('Platform update public key is not configured');
    }
    if (!verifyPlatformManifest(manifest, publicKey)) {
      this.logger.error('Refusing to publish an invalid platform update manifest');
      throw new ServiceUnavailableException('Platform update manifest verification failed');
    }
    return manifest;
  }

  async status() {
    this.assertOnPrem();
    const publicKeyConfigured = Boolean(getPlatformUpdatePublicKeyPem());
    try {
      const manifest = await this.loadManifest();
      const signatureValid =
        publicKeyConfigured && verifyPlatformManifest(manifest, getPlatformUpdatePublicKeyPem());
      return {
        enabled: true,
        currentVersion: process.env.PLATFORM_VERSION || process.env.npm_package_version || 'unknown',
        latestVersion: manifest.version,
        releaseDate: manifest.releaseDate,
        manifestAvailable: true,
        publicKeyConfigured,
        signatureValid,
      };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.warn(`Platform update status could not load manifest: ${(error as Error).message}`);
      }
      return {
        enabled: true,
        currentVersion: process.env.PLATFORM_VERSION || process.env.npm_package_version || 'unknown',
        latestVersion: null,
        manifestAvailable: false,
        publicKeyConfigured,
        signatureValid: false,
      };
    }
  }

  private assertOnPrem() {
    if (!isOnPrem()) throw new NotFoundException();
  }

  private async loadManifest(): Promise<PlatformUpdateManifest> {
    const inline = process.env.PLATFORM_UPDATE_MANIFEST_JSON?.trim();
    const path =
      process.env.PLATFORM_UPDATE_MANIFEST_PATH?.trim() ||
      resolve(process.cwd(), '.artifacts', 'platform-release.json');
    try {
      const raw = inline || (await readFile(path, 'utf8'));
      const manifest: unknown = JSON.parse(raw);
      assertPlatformUpdateManifest(manifest);
      return manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('No platform update manifest is available');
      }
      throw error;
    }
  }
}
