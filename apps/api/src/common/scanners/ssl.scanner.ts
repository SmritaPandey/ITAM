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
  authorized?: boolean;
  authorizationError?: string;
  protocolsSweep?: {
    tls10: boolean;
    tls11: boolean;
    tls12: boolean;
    tls13: boolean;
  };
  cipherSuiteAudit?: {
    score: number;
    level: 'RECOMMENDED' | 'SECURE' | 'WEAK' | 'INSECURE';
    description: string;
  };
  vulnerabilities?: {
    poodle: boolean;
    beast: boolean;
    sweet32: boolean;
    crime: boolean;
    freak: boolean;
    logjam: boolean;
  };
  certChain?: {
    subject: string;
    issuer: string;
    validTo: string;
    expired: boolean;
    selfSigned: boolean;
    signatureAlgorithm?: string;
  }[];
}

const WEAK_CIPHERS = ['RC4', 'DES', 'MD5', '3DES', 'NULL', 'EXPORT', 'anon'];

function formatDistinguishedName(name: any): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (name.CN) {
    return Array.isArray(name.CN) ? name.CN[0] : name.CN;
  }
  return JSON.stringify(name);
}

export class SslScanner {
  private static readonly logger = new Logger('SslScanner');

  static async isAvailable(): Promise<{ available: boolean }> {
    return { available: true }; // Uses Node.js built-in tls — always available
  }

  /**
   * Safe asynchronous protocol probe
   */
  private static async testProtocol(host: string, port: number, version: tls.SecureVersion, timeout = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = tls.connect({
        host,
        port,
        servername: host,
        minVersion: version,
        maxVersion: version,
        rejectUnauthorized: false,
      });

      socket.on('secureConnect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.setTimeout(timeout, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Audit SSL/TLS configuration of a host
   */
  static async scan(host: string, port = 443, timeout = 10000): Promise<SslCertInfo> {
    // 1. Perform Protocol Sweeping Concurrently to optimize speed
    const [supportTls10, supportTls11, supportTls12, supportTls13] = await Promise.all([
      this.testProtocol(host, port, 'TLSv1', 3000),
      this.testProtocol(host, port, 'TLSv1.1', 3000),
      this.testProtocol(host, port, 'TLSv1.2', 3000),
      this.testProtocol(host, port, 'TLSv1.3', 3000),
    ]);

    return new Promise((resolve, reject) => {
      const warnings: string[] = [];

      const socket = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: false, // Inspect untrusted cert chains
        timeout,
      }, () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol() || 'unknown';
        const authorized = socket.authorized;
        const authError = socket.authorizationError;

        if (!cert || !cert.subject) {
          socket.destroy();
          reject(new Error('No certificate received from host'));
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expired = daysRemaining < 0;
        const selfSigned = JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);

        // Subject Alternative Names (SANs) extraction
        const sans: string[] = [];
        if (cert.subjectaltname) {
          for (const san of cert.subjectaltname.split(',')) {
            sans.push(san.trim().replace('DNS:', ''));
          }
        }

        // Cipher strength audit
        const cipherName = cipher?.name || '';
        const cipherBits = (cipher as any)?.bits || 0;
        const weakCipher = WEAK_CIPHERS.some(w => cipherName.toUpperCase().includes(w)) || cipherBits < 128;

        let cipherScore = 10;
        let cipherLevel: 'RECOMMENDED' | 'SECURE' | 'WEAK' | 'INSECURE' = 'RECOMMENDED';
        let cipherDesc = 'Secure industry-standard cipher suite';

        if (weakCipher) {
          cipherScore = 0;
          cipherLevel = 'INSECURE';
          cipherDesc = 'Obsolete/insecure algorithm with known severe vulnerabilities (e.g. RC4, 3DES, MD5, NULL)';
        } else {
          const isAEAD = cipherName.includes('GCM') || cipherName.includes('POLY1305') || cipherName.includes('CCM');
          const isECDHE = cipherName.includes('ECDHE');
          const isDHE = cipherName.includes('DHE') && !cipherName.includes('ECDHE');

          if (isAEAD && isECDHE && cipherBits >= 256) {
            cipherScore = 10;
            cipherLevel = 'RECOMMENDED';
            cipherDesc = 'Highly recommended cipher with authenticated encryption (AEAD) and strong elliptic curve forward secrecy';
          } else if (isAEAD && (isECDHE || isDHE) && cipherBits >= 128) {
            cipherScore = 9;
            cipherLevel = 'SECURE';
            cipherDesc = 'Secure cipher suite with authenticated encryption (AEAD) and forward secrecy';
          } else if (isAEAD && cipherBits >= 128) {
            cipherScore = 8;
            cipherLevel = 'SECURE';
            cipherDesc = 'Secure cipher suite using AEAD, but missing elliptic curve forward secrecy';
          } else if (cipherName.includes('CBC')) {
            cipherScore = 5;
            cipherLevel = 'WEAK';
            cipherDesc = 'Legacy CBC block cipher. Prone to padding oracle vulnerabilities (e.g. Lucky Thirteen)';
          } else {
            cipherScore = 6;
            cipherLevel = 'WEAK';
            cipherDesc = 'Legacy non-AEAD or custom cipher suite';
          }
        }

        // Vulnerability assessment heuristics
        const poodle = supportTls10 && cipherName.includes('CBC'); // POODLE TLS variant
        const beast = supportTls10 && cipherName.includes('CBC');  // BEAST is active on TLS 1.0 CBC
        const sweet32 = cipherName.includes('3DES') || cipherName.includes('IDEA');
        const crime = (socket as any).compression || false; // Check if SSL compression is enabled
        const freak = cipherName.includes('EXPORT');
        const logjam = cipherName.includes('DHE_EXPORT') || (cipherName.includes('DHE') && cipherBits < 128);

        // Trust Chain Parsing and Intermediate Self-Signed Checks
        const certChain: SslCertInfo['certChain'] = [];
        let chainLength = 0;
        let current = cert;

        while (current) {
          chainLength++;
          const cSelfSigned = JSON.stringify(current.issuer) === JSON.stringify(current.subject);
          const cExpired = new Date(current.valid_to).getTime() < now.getTime();

          certChain.push({
            subject: formatDistinguishedName(current.subject),
            issuer: formatDistinguishedName(current.issuer),
            validTo: new Date(current.valid_to).toISOString(),
            expired: cExpired,
            selfSigned: cSelfSigned,
            signatureAlgorithm: (current as any).sigalg || undefined,
          });

          // Move up the chain
          if (current.issuerCertificate && current.issuerCertificate !== current) {
            current = current.issuerCertificate;
          } else {
            break;
          }

          if (chainLength > 10) break; // Avoid infinite loops in malicious circular chains
        }

        // Warnings Gathering
        if (expired) warnings.push('Certificate has EXPIRED');
        if (daysRemaining >= 0 && daysRemaining <= 30) warnings.push(`Certificate expires in ${daysRemaining} days`);
        if (selfSigned) warnings.push('Self-signed certificate (Untrusted chain root)');
        if (weakCipher) warnings.push(`Weak cipher suite detected: ${cipherName} (${cipherBits} bits)`);
        if (supportTls10) warnings.push('Deprecated Protocol TLS 1.0 is supported by the server');
        if (supportTls11) warnings.push('Deprecated Protocol TLS 1.1 is supported by the server');
        if (!cert.subjectaltname) warnings.push('Certificate lacks Subject Alternative Names (SANs)');
        if (!authorized) warnings.push(`Certificate is not trusted: ${authError || 'unknown CA validation failure'}`);
        
        // Vulnerabilities Warnings
        if (beast) warnings.push('Vulnerable to BEAST (TLS 1.0 supporting CBC ciphers)');
        if (poodle) warnings.push('Vulnerable to POODLE TLS (Legacy TLS with CBC ciphers allowed)');
        if (sweet32) warnings.push('Vulnerable to SWEET32 (Uses obsolete 64-bit block ciphers)');
        if (crime) warnings.push('Vulnerable to CRIME (SSL/TLS compression active)');
        if (logjam) warnings.push('Vulnerable to LOGJAM (Weak export Diffie-Hellman keys or cipher bits)');

        // Intermediate certificate issues
        if (certChain.length > 1 && certChain.slice(0, -1).some(c => c.selfSigned)) {
          warnings.push('Intermediate certificate is self-signed (Severe Chain Malformation)');
        }

        // 5. Refined A+ to F Grading Matrix
        let grade: SslCertInfo['grade'] = 'A+';
        if (expired || !supportTls12 && !supportTls13) {
          grade = 'F'; // Expired or completely lacks modern TLS protocols
        } else if (weakCipher || cipherLevel === 'INSECURE') {
          grade = 'F'; // Obsolete or insecure cipher
        } else if (poodle || sweet32 || freak || logjam) {
          grade = 'F'; // Confirmed severe vulnerabilities
        } else if (selfSigned || !authorized) {
          grade = 'D'; // Untrusted cert chain
        } else if (supportTls10 || supportTls11) {
          grade = 'C'; // Capped due to obsolete TLS 1.0/1.1 protocols
        } else if (beast || crime) {
          grade = 'C'; // Capped due to minor vulnerabilities
        } else if (daysRemaining <= 7) {
          grade = 'B'; // Valid but extremely close to expiration
        } else if (daysRemaining <= 30) {
          grade = 'A'; // Valid but near expiration
        } else if (warnings.length > 0) {
          grade = 'A'; // Valid with standard config remarks
        }

        const result: SslCertInfo = {
          host,
          port,
          valid: !expired && !selfSigned && authorized,
          issuer: typeof cert.issuer === 'string' ? { CN: cert.issuer } : cert.issuer as any,
          subject: typeof cert.subject === 'string' ? { CN: cert.subject } : cert.subject as any,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
          sans,
          protocol,
          cipher: { name: cipherName, version: cipher?.version || '', bits: cipherBits },
          selfSigned,
          expired,
          weakCipher,
          chainLength,
          grade,
          warnings,
          authorized,
          authorizationError: authError ? (typeof authError === 'string' ? authError : (authError as Error).message) : undefined,
          protocolsSweep: {
            tls10: supportTls10,
            tls11: supportTls11,
            tls12: supportTls12,
            tls13: supportTls13,
          },
          cipherSuiteAudit: {
            score: cipherScore,
            level: cipherLevel,
            description: cipherDesc,
          },
          vulnerabilities: {
            poodle,
            beast,
            sweet32,
            crime,
            freak,
            logjam,
          },
          certChain,
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
          host: h.host,
          port: h.port || 443,
          valid: false,
          grade: 'F',
          warnings: [`Connection failed: ${err.message}`],
        } as any);
      }
    }
    return results;
  }
}
