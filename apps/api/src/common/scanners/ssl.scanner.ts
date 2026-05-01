import { Logger } from '@nestjs/common';
import * as tls from 'tls';

export interface SslCertInfo {
  host: string;
  port: number;
  valid: boolean;
  issuer: Record<string, string>;
  subject: Record<string, string>;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  serialNumber: string;
  fingerprint: string;
  fingerprint256: string;
  sans: string[];
  protocol: string;
  cipher: { name: string; version: string; bits: number };
  selfSigned: boolean;
  expired: boolean;
  weakCipher: boolean;
  chainLength: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  warnings: string[];
}

const WEAK_CIPHERS = ['RC4', 'DES', 'MD5', '3DES', 'NULL', 'EXPORT', 'anon'];

export class SslScanner {
  private static readonly logger = new Logger('SslScanner');

  static async isAvailable(): Promise<{ available: boolean }> {
    return { available: true }; // Uses Node.js built-in tls — always available
  }

  /**
   * Audit SSL/TLS configuration of a host
   */
  static async scan(host: string, port = 443, timeout = 10000): Promise<SslCertInfo> {
    return new Promise((resolve, reject) => {
      const warnings: string[] = [];

      const socket = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: false, // We want to inspect even bad certs
        timeout,
      }, () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol() || 'unknown';

        if (!cert || !cert.subject) {
          socket.destroy();
          reject(new Error('No certificate received'));
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expired = daysRemaining < 0;
        const selfSigned = JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);

        // SANs
        const sans: string[] = [];
        if (cert.subjectaltname) {
          for (const san of cert.subjectaltname.split(',')) {
            sans.push(san.trim().replace('DNS:', ''));
          }
        }

        // Check for weak ciphers
        const cipherName = cipher?.name || '';
        const weakCipher = WEAK_CIPHERS.some(w => cipherName.toUpperCase().includes(w));

        // Warnings
        if (expired) warnings.push('Certificate has EXPIRED');
        if (daysRemaining >= 0 && daysRemaining <= 30) warnings.push(`Certificate expires in ${daysRemaining} days`);
        if (selfSigned) warnings.push('Self-signed certificate');
        if (weakCipher) warnings.push(`Weak cipher: ${cipherName}`);
        if (protocol === 'TLSv1' || protocol === 'TLSv1.1') warnings.push(`Deprecated protocol: ${protocol}`);
        if (!cert.subjectaltname) warnings.push('No Subject Alternative Names (SANs)');

        // Chain length
        let chainLength = 1;
        let current = cert;
        while (current.issuerCertificate && current.issuerCertificate !== current) {
          chainLength++;
          current = current.issuerCertificate;
          if (chainLength > 10) break;
        }

        // Grade
        let grade: SslCertInfo['grade'] = 'A+';
        if (expired) grade = 'F';
        else if (selfSigned) grade = 'D';
        else if (weakCipher) grade = 'C';
        else if (protocol === 'TLSv1' || protocol === 'TLSv1.1') grade = 'C';
        else if (daysRemaining <= 7) grade = 'B';
        else if (daysRemaining <= 30) grade = 'A';
        else if (warnings.length === 0) grade = 'A+';
        else grade = 'A';

        const result: SslCertInfo = {
          host,
          port,
          valid: !expired && !selfSigned,
          issuer: cert.issuer as any,
          subject: cert.subject as any,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
          sans,
          protocol,
          cipher: { name: cipherName, version: cipher?.version || '', bits: (cipher as any)?.bits || 0 },
          selfSigned,
          expired,
          weakCipher,
          chainLength,
          grade,
          warnings,
        };

        socket.destroy();
        resolve(result);
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`SSL connection to ${host}:${port} timed out`));
      });
    });
  }

  /**
   * Scan multiple hosts
   */
  static async scanMultiple(hosts: { host: string; port?: number }[]): Promise<SslCertInfo[]> {
    const results: SslCertInfo[] = [];
    for (const h of hosts) {
      try {
        const r = await this.scan(h.host, h.port || 443);
        results.push(r);
      } catch (err: any) {
        results.push({
          host: h.host, port: h.port || 443, valid: false, grade: 'F',
          warnings: [`Connection failed: ${err.message}`],
        } as any);
      }
    }
    return results;
  }
}
