# 📦 ITAM Enterprise - Complete Installation Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Development Installation](#development-installation)
3. [Production Installation](#production-installation)
4. [Desktop Application](#desktop-application)
5. [Scanner Deployment](#scanner-deployment)
6. [Verification](#verification)

---

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 20.04+

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 100 GB SSD
- **OS**: Windows 11, macOS 13+, Ubuntu 22.04 LTS

### Software Prerequisites
- **Node.js**: 18.x or higher
- **Python**: 3.8 or higher
- **MongoDB**: 6.0+ (or MongoDB Atlas)
- **Docker**: 20.10+ (optional)
- **Git**: Latest version

---

## Development Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd itam-enterprise
```

### 2. Install Backend

```bash
cd server

# Install dependencies
npm install

# Create environment file
cp ../.env.example .env

# Edit .env with your settings
nano .env

# Create superadmin user
node scripts/create-superadmin.js
```

**Default credentials:**
- Email: admin@itam.com
- Password: admin123

### 3. Install Frontend

```bash
cd ../client

# Install dependencies
npm install
```

### 4. Install Python Scanners

```bash
cd ../scanners

# Install dependencies
pip install -r requirements.txt
```

### 5. Install ML Service

```bash
cd ../ml_service

# Install dependencies
pip install scikit-learn pandas numpy scipy flask
```

### 6. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Terminal 3 - ML Service (optional):**
```bash
cd ml_service
python standalone_ml_service.py
```

**Terminal 4 - Scanner (optional):**
```bash
cd scanners
python itam_scanner.py
```

### 7. Access Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs
- **ML Service**: http://localhost:5000

---

## Production Installation

### Option 1: Docker Deployment (Recommended)

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

#### Steps

1. **Clone repository:**
```bash
git clone <repository-url>
cd itam-enterprise
```

2. **Configure environment:**
```bash
cp .env.example .env
nano .env
```

**Edit these variables:**
```env
MONGODB_URI=mongodb://admin:changeme@mongodb:27017/itam_enterprise?authSource=admin
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

3. **Start services:**
```bash
docker-compose up -d
```

4. **Verify services:**
```bash
docker-compose ps
```

5. **Create superadmin:**
```bash
docker-compose exec server node scripts/create-superadmin.js
```

6. **Access application:**
- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- API Docs: http://localhost:3000/api-docs

#### Docker Management

**View logs:**
```bash
docker-compose logs -f
```

**Restart services:**
```bash
docker-compose restart
```

**Stop services:**
```bash
docker-compose down
```

**Update images:**
```bash
docker-compose pull
docker-compose up -d
```

---

### Option 2: Manual Production Installation

#### Prerequisites
- Linux server (Ubuntu 22.04 recommended)
- Node.js 18+
- Python 3.8+
- MongoDB 6.0+
- Nginx
- PM2 (process manager)

#### Step-by-Step Installation

**1. Update system:**
```bash
sudo apt update && sudo apt upgrade -y
```

**2. Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**3. Install Python:**
```bash
sudo apt install -y python3 python3-pip python3-venv
```

**4. Install MongoDB:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**5. Install Nginx:**
```bash
sudo apt install -y nginx
```

**6. Install PM2:**
```bash
sudo npm install -g pm2
```

**7. Clone and setup application:**
```bash
cd /opt
sudo git clone <repository-url> itam-enterprise
cd itam-enterprise
sudo chown -R $USER:$USER .
```

**8. Setup backend:**
```bash
cd /opt/itam-enterprise/server
npm install --production
cp ../.env.example .env
nano .env
node scripts/create-superadmin.js
```

**9. Setup frontend:**
```bash
cd /opt/itam-enterprise/client
npm install
npm run build
```

**10. Setup scanners:**
```bash
cd /opt/itam-enterprise/scanners
pip3 install -r requirements.txt
```

**11. Setup ML service:**
```bash
cd /opt/itam-enterprise/ml_service
pip3 install scikit-learn pandas numpy scipy flask
```

**12. Configure PM2:**
```bash
cd /opt/itam-enterprise

# Start backend
cd server
pm2 start index.js --name itam-api

# Start frontend
cd ../client
pm2 start npm --name itam-client -- start

# Start ML service
cd ../ml_service
pm2 start standalone_ml_service.py --name itam-ml --interpreter python3

# Save PM2 configuration
pm2 save
pm2 startup
```

**13. Configure Nginx:**
```bash
sudo nano /etc/nginx/sites-available/itam-enterprise
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/itam-enterprise /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**14. Setup SSL (Let's Encrypt):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Desktop Application

### Building Desktop Apps

**Prerequisites:**
- Node.js 18+
- Internet connection (for downloading dependencies)

### Windows

```bash
cd desktop
npm install
npm run build:win
```

**Output:** `dist/ITAM-Enterprise-1.0.0-x64.exe`

**Installation:**
1. Double-click the installer
2. Follow setup wizard
3. Launch from Start Menu

### macOS

```bash
cd desktop
npm install
npm run build:mac
```

**Output:** `dist/ITAM-Enterprise-1.0.0-x64.dmg`

**Installation:**
1. Open DMG file
2. Drag to Applications
3. Launch from Applications

### Linux

```bash
cd desktop
npm install
npm run build:linux
```

**Output:**
- `dist/ITAM-Enterprise-1.0.0-x64.AppImage`
- `dist/itam-enterprise_1.0.0_amd64.deb`
- `dist/itam-enterprise-1.0.0.x86_64.rpm`

**Installation:**

**AppImage:**
```bash
chmod +x ITAM-Enterprise-*.AppImage
./ITAM-Enterprise-*.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i itam-enterprise_*.deb
```

**RHEL/Fedora:**
```bash
sudo rpm -i itam-enterprise-*.rpm
```

---

## Scanner Deployment

### Windows

**Option 1: Install as Service**
```cmd
cd scanners
run_itam_scanner_service.ps1
```

**Option 2: Manual Install**
```cmd
install_windows_service.bat
```

**Uninstall:**
```cmd
uninstall_windows_service.bat
```

### Linux

**Install as Systemd Service:**
```bash
cd scanners
sudo bash install_linux_service.sh
```

**Manage service:**
```bash
# Check status
sudo systemctl status itam-scanner

# View logs
sudo journalctl -u itam-scanner -f

# Restart
sudo systemctl restart itam-scanner

# Stop
sudo systemctl stop itam-scanner
```

**Uninstall:**
```bash
sudo bash uninstall_linux_service.sh
```

### macOS

**Option 1: LaunchAgent**
Create file: `~/Library/LaunchAgents/com.itam.scanner.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.itam.scanner</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/path/to/itam_scanner.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

**Load:**
```bash
launchctl load ~/Library/LaunchAgents/com.itam.scanner.plist
```

**Option 2: Manual Run**
```bash
cd scanners
python3 itam_scanner.py
```

---

## Verification

### 1. Check Services

**Docker:**
```bash
docker-compose ps
```

**Manual:**
```bash
pm2 status
sudo systemctl status mongod
sudo systemctl status nginx
```

### 2. Test API

```bash
# Health check
curl http://localhost:3000/api/health

# API documentation
open http://localhost:3000/api-docs
```

### 3. Test Frontend

```bash
open http://localhost:3001
```

### 4. Test Scanner

```bash
cd scanners
python itam_scanner.py
```

Check logs in `scanners/logs/itam_scanner.log`

### 5. Test Desktop App

Launch the application and:
1. Configure server URL
2. Login with credentials
3. Verify functionality

---

## Common Issues

### Port Already in Use

**Check what's using the port:**
```bash
# Linux/macOS
lsof -i :3000
lsof -i :3001

# Windows
netstat -ano | findstr :3000
```

**Kill process:**
```bash
# Linux/macOS
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

### MongoDB Connection Failed

**Check MongoDB:**
```bash
sudo systemctl status mongod
mongosh --eval "db.adminCommand('ping')"
```

**Restart MongoDB:**
```bash
sudo systemctl restart mongod
```

### Permission Denied

**Linux/macOS:**
```bash
sudo chown -R $USER:$USER /opt/itam-enterprise
chmod -R 755 /opt/itam-enterprise
```

### Scanner Not Working

**Install dependencies:**
```bash
pip3 install -r scanners/requirements.txt
```

**Check permissions:**
```bash
# Linux: May need root for some system info
sudo python3 itam_scanner.py
```

---

## Updating

### Docker
```bash
docker-compose pull
docker-compose up -d
```

### Manual
```bash
cd /opt/itam-enterprise
git pull
cd server && npm install
cd ../client && npm install && npm run build
pm2 restart all
```

---

## Backup

### Manual Backup
```bash
# MongoDB
mongodump --db itam_enterprise --out /backups/itam-$(date +%Y%m%d)

# Application
tar -czf /backups/itam-app-$(date +%Y%m%d).tar.gz /opt/itam-enterprise
```

### Automated Backup
Use the built-in backup API:
```bash
curl -X POST http://localhost:3000/api/backup/create \
  -H "Authorization: Bearer <admin-token>"
```

---

## Support

For installation issues:
1. Check logs: `docker-compose logs` or `pm2 logs`
2. Review error messages
3. Check system requirements
4. Consult documentation
5. Contact support

---

**Installation complete! 🎉**

Your ITAM Enterprise system is now ready for use.
