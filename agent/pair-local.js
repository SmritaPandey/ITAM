// ═══════════════════════════════════════════════════════════════
// QS Discovery Agent — Local Pairing Utility
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER = 'http://localhost:4100';
const EMAIL = 'admin@acme.com';
const PASSWORD = 'Admin@123';

console.log('📡 Authenticating locally with QS API Server...');

const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
const url = `${SERVER}/api/v1/auth/login`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
})
  .then(async (res) => {
    if (res.status !== 200) {
      console.error(`❌ Authentication failed. Status code: ${res.status}`);
      process.exit(1);
    }
    
    const data = await res.json();
    if (!data.accessToken) {
      console.error('❌ Failed to retrieve accessToken.');
      process.exit(1);
    }

    console.log('✅ Authenticated successfully.');
    
    const config = {
      server: SERVER,
      token: data.accessToken
    };
    
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`📦 Wrote local config.json to: ${configPath}`);
    
    // Restart launch agent on Mac
    try {
      const plistPath = path.join(process.env.HOME, 'Library/LaunchAgents/com.qsasset.discovery.agent.plist');
      if (fs.existsSync(plistPath)) {
        console.log('🚀 Restarting macOS LaunchAgent to apply config...');
        execSync(`launchctl unload "${plistPath}" 2>/dev/null || true`);
        execSync(`launchctl load "${plistPath}"`);
        console.log('✅ Service restarted successfully and running silently in the background!');
      }
    } catch (err) {
      console.log('⚠️ Could not auto-restart launchctl daemon. Restart manually.');
    }
  })
  .catch((err) => {
    console.error('❌ Network error connected to local API:', err.message);
    process.exit(1);
  });
