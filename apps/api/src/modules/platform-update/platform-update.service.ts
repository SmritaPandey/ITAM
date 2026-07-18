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

  /** SaaS-safe owner view of release-channel / signing readiness. */
  async ownerStatus() {
    const platformPublic = Boolean(getPlatformUpdatePublicKeyPem());
    const platformPrivate = Boolean(process.env.PLATFORM_UPDATE_PRIVATE_KEY?.trim());
    const agentPublic = Boolean(process.env.AGENT_UPDATE_PUBLIC_KEY?.trim());
    const agentPrivate = Boolean(process.env.AGENT_UPDATE_PRIVATE_KEY?.trim());
    const licensePublic = Boolean(process.env.LICENSE_PUBLIC_KEY?.trim());
    const licensePrivate = Boolean(process.env.LICENSE_PRIVATE_KEY?.trim());
    const onPrem = isOnPrem();
    let onPremStatus: Awaited<ReturnType<PlatformUpdateService['status']>> | null = null;
    if (onPrem) {
      try {
        onPremStatus = await this.status();
      } catch {
        onPremStatus = null;
      }
    }
    return {
      deploymentMode: onPrem ? 'onprem' : 'saas',
      currentVersion: process.env.PLATFORM_VERSION || process.env.npm_package_version || 'unknown',
      channels: {
        productLicense: { publicKeyConfigured: licensePublic, privateKeyConfigured: licensePrivate },
        agentUpdate: { publicKeyConfigured: agentPublic, privateKeyConfigured: agentPrivate },
        platformUpdate: { publicKeyConfigured: platformPublic, privateKeyConfigured: platformPrivate },
      },
      onPrem: onPremStatus,
      releaseDocs: {
        applianceInstall: '/docs/APPLIANCE-INSTALL.md',
        githubReleases: 'https://github.com/SmritaPandey/ITAM/releases',
      },
      note: onPrem
        ? 'On-prem updates are applied via qsassets upgrade / scripts/onprem-updater.sh after verifying the signed manifest.'
        : 'SaaS hosts do not auto-update via the platform channel. Use this view to confirm signing keys and issue on-prem licenses.',
    };
  }

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
