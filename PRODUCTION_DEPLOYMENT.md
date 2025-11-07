# Production Deployment Guide

## Enterprise Asset Management System - Production Deployment

### Table of Contents
1. [System Requirements](#system-requirements)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Options](#deployment-options)
4. [Installation Steps](#installation-steps)
5. [Security Hardening](#security-hardening)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Backup and Recovery](#backup-and-recovery)
8. [Scaling](#scaling)

---

## System Requirements

### Minimum Requirements
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **OS**: Ubuntu 20.04+, Windows Server 2019+, or RHEL 8+
- **Network**: 100 Mbps connection

### Recommended Requirements
- **CPU**: 8+ cores
- **RAM**: 16+ GB
- **Storage**: 500 GB SSD (RAID 1)
- **OS**: Ubuntu 22.04 LTS or RHEL 9
- **Network**: 1 Gbps connection
- **Database**: Dedicated MongoDB server or MongoDB Atlas cluster

### Software Requirements
- **Node.js**: v18.x or higher
- **Python**: 3.8+ (for ML service and scanners)
- **MongoDB**: 6.0+ or MongoDB Atlas
- **Nginx**: 1.18+ (for reverse proxy)
- **Docker**: 20.10+ (optional, for containerized deployment)
- **SSL Certificate**: Valid SSL/TLS certificate

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx)                    │
│                    SSL Termination (HTTPS)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Client  │    │ Client  │    │ Client  │
    │ App #1  │    │ App #2  │    │ App #3  │
    │(Next.js)│    │(Next.js)│    │(Next.js)│
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Server  │    │ Server  │    │ Server  │
    │ API #1  │    │ API #2  │    │ API #3  │
    │(Express)│    │(Express)│    │(Express)│
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ MongoDB │    │   ML    │    │  Redis  │
    │ Cluster │    │ Service │    │  Cache  │
    │         │    │(Python) │    │         │
    └─────────┘    └─────────┘    └─────────┘
```

---

## Deployment Options

### Option 1: Traditional Server Deployment

**Best for**: Organizations with existing infrastructure

1. Single server deployment (small organizations)
2. Multi-server deployment (medium to large organizations)
3. High availability deployment (enterprise)

### Option 2: Docker Deployment

**Best for**: Modern DevOps environments

- Easy scaling
- Consistent environments
- Simplified deployment

### Option 3: Kubernetes Deployment

**Best for**: Large enterprises with container orchestration

- Auto-scaling
- Self-healing
- Zero-downtime deployments

### Option 4: Cloud Deployment

**Best for**: Organizations preferring managed services

- AWS (EC2, RDS, S3)
- Azure (App Service, Cosmos DB, Blob Storage)
- Google Cloud (Compute Engine, Cloud SQL, Cloud Storage)

---

## Installation Steps

### Step 1: Prepare the Environment

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python and dependencies
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB (or use MongoDB Atlas)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Clone and Configure Application

```bash
# Clone repository
git clone <repository-url> /opt/itam-enterprise
cd /opt/itam-enterprise

# Create environment file
cp .env.example .env

# Edit .env with production values
nano .env
```

### Step 3: Install Dependencies

```bash
# Server dependencies
cd /opt/itam-enterprise/server
npm install --production

# Client dependencies
cd /opt/itam-enterprise/client
npm install
npm run build

# ML Service dependencies
cd /opt/itam-enterprise/ml_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Scanner dependencies
cd /opt/itam-enterprise/scanners
pip install -r requirements.txt
```

### Step 4: Configure Database

```bash
# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database and initial user
mongosh <<EOF
use itam_enterprise
db.createUser({
  user: "itam_admin",
  pwd: "secure_password_here",
  roles: [{ role: "dbOwner", db: "itam_enterprise" }]
})
EOF

# Create superadmin user
cd /opt/itam-enterprise/server
node scripts/create-superadmin.js
```

### Step 5: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/itam-enterprise
```

Add the following configuration:

```nginx
# Upstream servers
upstream api_backend {
    least_conn;
    server 127.0.0.1:3000;
    # Add more servers for load balancing
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

upstream client_backend {
    least_conn;
    server 127.0.0.1:3001;
    # Add more servers for load balancing
    # server 127.0.0.1:3011;
    # server 127.0.0.1:3012;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/itam-access.log;
    error_log /var/log/nginx/itam-error.log;

    # Client Application
    location / {
        proxy_pass http://client_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API Routes
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate Limiting
        limit_req zone=api_limit burst=20 nodelay;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static Files
    location /_next/static {
        proxy_cache STATIC;
        proxy_pass http://client_backend;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # File Upload Limit
    client_max_body_size 100M;
}

# Rate Limiting Zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/itam-enterprise /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Start Services with PM2

```bash
# Server API
cd /opt/itam-enterprise/server
pm2 start index.js --name itam-api -i max --watch

# Client Application
cd /opt/itam-enterprise/client
pm2 start npm --name itam-client -- start

# ML Service
cd /opt/itam-enterprise/ml_service
pm2 start standalone_ml_service.py --name itam-ml --interpreter python3

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## Security Hardening

### 1. Firewall Configuration

```bash
# UFW Configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. MongoDB Security

```bash
# Edit MongoDB configuration
sudo nano /etc/mongod.conf
```

Add:
```yaml
security:
  authorization: enabled
net:
  bindIp: 127.0.0.1
```

```bash
sudo systemctl restart mongod
```

### 3. Application Security

- Enable rate limiting (already configured in Nginx)
- Use strong JWT secrets
- Enable CORS only for trusted domains
- Implement input validation
- Use parameterized queries
- Enable audit logging
- Implement 2FA for admin accounts
- Regular security audits

### 4. SSL/TLS Configuration

```bash
# Install Certbot for Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Monitoring and Maintenance

### 1. System Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# PM2 Monitoring
pm2 monit

# System logs
pm2 logs

# Nginx logs
tail -f /var/log/nginx/itam-access.log
tail -f /var/log/nginx/itam-error.log
```

### 2. Application Monitoring

Set up monitoring with:
- **New Relic** or **DataDog**: Application performance monitoring
- **Sentry**: Error tracking
- **Grafana + Prometheus**: Metrics visualization
- **ELK Stack**: Log aggregation and analysis

### 3. Database Monitoring

```bash
# MongoDB monitoring
mongosh --eval "db.serverStatus()"
mongosh --eval "db.stats()"

# Check database size
mongosh --eval "db.stats().dataSize"
```

---

## Backup and Recovery

### 1. Automated Backups

```bash
# Create backup script
sudo nano /opt/itam-enterprise/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/itam"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_DB="itam_enterprise"

# Create backup directory
mkdir -p $BACKUP_DIR

# MongoDB backup
mongodump --db $MONGO_DB --out $BACKUP_DIR/mongo_$DATE

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/itam-enterprise

# Uploads backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/itam-enterprise/server/uploads

# Delete backups older than 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/itam-enterprise/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/itam-enterprise/backup.sh") | crontab -
```

### 2. Disaster Recovery

```bash
# Restore MongoDB
mongorestore --db itam_enterprise /backups/itam/mongo_YYYYMMDD_HHMMSS/itam_enterprise

# Restore application
tar -xzf /backups/itam/app_YYYYMMDD_HHMMSS.tar.gz -C /

# Restore uploads
tar -xzf /backups/itam/uploads_YYYYMMDD_HHMMSS.tar.gz -C /opt/itam-enterprise/server/

# Restart services
pm2 restart all
```

---

## Scaling

### Horizontal Scaling

```bash
# Add more API servers
cd /opt/itam-enterprise/server
pm2 start index.js --name itam-api-2 -i max
pm2 start index.js --name itam-api-3 -i max

# Update Nginx upstream configuration
# Add more backend servers in nginx config

# Reload Nginx
sudo nginx -s reload
```

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize MongoDB indexes
- Enable Redis caching
- Use CDN for static assets

### Database Scaling

- MongoDB Sharding
- Read replicas
- Indexing optimization
- Query optimization

---

## Performance Optimization

### 1. Database Optimization

```javascript
// Create indexes
mongosh itam_enterprise <<EOF
db.hardware_data.createIndex({ tenant_id: 1, createdAt: -1 })
db.users.createIndex({ tenant_id: 1, email: 1 })
db.telemetry.createIndex({ mac_address: 1, timestamp: -1 })
db.tickets.createIndex({ tenant_id: 1, status: 1, created_at: -1 })
EOF
```

### 2. Application Optimization

- Enable compression in Nginx
- Implement Redis caching
- Optimize API queries
- Use connection pooling
- Enable CDN for static assets

### 3. Client Optimization

- Code splitting
- Lazy loading
- Image optimization
- Minimize bundle size
- Enable service workers

---

## Troubleshooting

### Common Issues

1. **503 Service Unavailable**
   - Check if services are running: `pm2 list`
   - Check service logs: `pm2 logs`
   - Restart services: `pm2 restart all`

2. **Database Connection Errors**
   - Verify MongoDB is running: `sudo systemctl status mongod`
   - Check connection string in `.env`
   - Verify credentials

3. **High Memory Usage**
   - Check PM2 processes: `pm2 monit`
   - Restart services: `pm2 restart all`
   - Consider increasing server resources

4. **Slow Performance**
   - Check database indexes
   - Enable caching
   - Review Nginx logs
   - Monitor server resources

---

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Monitor logs and alerts
- **Weekly**: Review performance metrics
- **Monthly**: Security updates, backup verification
- **Quarterly**: Security audit, capacity planning
- **Annually**: Disaster recovery drill, architecture review

### Update Procedure

```bash
# Backup before update
/opt/itam-enterprise/backup.sh

# Pull latest changes
cd /opt/itam-enterprise
git pull origin main

# Update dependencies
cd server && npm install
cd ../client && npm install && npm run build
cd ../ml_service && pip install -r requirements.txt

# Restart services
pm2 restart all

# Verify services
pm2 status
pm2 logs --lines 100
```

---

## License and Support

For enterprise support, licensing, and custom development:
- Email: support@yourdomain.com
- Website: https://yourdomain.com
- Documentation: https://docs.yourdomain.com

---

**© 2025 ITAM Enterprise - IT Asset Management System**
