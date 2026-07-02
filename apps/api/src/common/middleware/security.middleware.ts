import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security middleware — applies defense-in-depth protections to all requests.
 * 
 * Protections:
 * - Blocks suspicious user agents (scanners, bots)
 * - Blocks path traversal attempts  
 * - Enforces request size sanity
 * - Logs suspicious activity
 * - Strips dangerous headers
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SecurityMiddleware');

  // Known malicious scanner user agents
  private readonly blockedAgents = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'dirbuster',
    'gobuster', 'wfuzz', 'hydra', 'metasploit',
  ];

  // Dangerous path patterns
  private readonly blockedPaths = [
    /\.\.\//, /\.\.\\/,           // Path traversal
    /\0/,                          // Null bytes
    /\/etc\/passwd/i,              // System file access
    /\/proc\//i,                   // Proc filesystem
    /\.(env|git|svn|htaccess)/i,   // Config/VCS files
    /\/(wp-admin|wp-login|xmlrpc)/i, // WordPress probes
    /\/phpmyadmin/i,               // phpMyAdmin probes
    /\/(cgi-bin|admin|manager)/i,  // Common admin panels
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const path = req.originalUrl || req.url;

    // 1. Block known malicious user agents
    if (this.blockedAgents.some(agent => ua.includes(agent))) {
      this.logger.warn(`Blocked malicious scanner: ${ua} from ${req.ip}`);
      return res.status(403).json({ statusCode: 403, message: 'Forbidden' });
    }

    // 2. Block path traversal and dangerous paths
    if (this.blockedPaths.some(pattern => pattern.test(path))) {
      this.logger.warn(`Blocked suspicious path: ${path} from ${req.ip}`);
      return res.status(400).json({ statusCode: 400, message: 'Bad Request' });
    }

    // 3. Block excessively long URLs (potential buffer overflow)
    if (path.length > 2048) {
      this.logger.warn(`Blocked oversized URL (${path.length} chars) from ${req.ip}`);
      return res.status(414).json({ statusCode: 414, message: 'URI Too Long' });
    }

    // 4. Block requests with too many query parameters (DoS protection)
    const queryParams = Object.keys(req.query || {});
    if (queryParams.length > 50) {
      this.logger.warn(`Blocked request with ${queryParams.length} query params from ${req.ip}`);
      return res.status(400).json({ statusCode: 400, message: 'Too many query parameters' });
    }

    // 5. Strip dangerous incoming headers
    delete req.headers['x-forwarded-host'];
    delete req.headers['x-original-url'];
    delete req.headers['x-rewrite-url'];

    next();
  }
}
