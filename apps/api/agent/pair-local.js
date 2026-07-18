// ═══════════════════════════════════════════════════════════════
// QS Discovery Agent — Local Pairing Utility
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const SERVER = 'http://localhost:4100';

function promptUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function getCredentials() {
  let email = process.env.QS_ADMIN_EMAIL;
  let password = process.env.QS_ADMIN_PASSWORD;
  if (!email) {
    email = await promptUser('Enter admin email: ');
  }
  if (!password) {
    password = await promptUser('Enter admin password: ');
  }
  return { email, password };
}

async function main() {
const { email, password } = await getCredentials();

console.log('📡 Authenticating locally with QS API Server...');

const body = JSON.stringify({ email, password });
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
      token: data.accessToken,
      email: email
    };
    
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    // Restrict permissions on config file (contains a bearer token)
    try { if (process.platform !== 'win32') fs.chmodSync(configPath, 0o600); } catch {}
    console.log(`📦 Wrote local config.json to: ${configPath}`);
    
    // Restart launch agent / daemon on Mac
    try {
      const plistPath = path.join(process.env.HOME || '', 'Library/LaunchAgents/com.qsasset.discovery.agent.plist');
      const daemonPath = '/Library/LaunchDaemons/com.qsasset.discovery.agent.plist';
      if (fs.existsSync(plistPath)) {
        console.log('🚀 Restarting macOS LaunchAgent to apply config...');
        execSync(`launchctl unload "${plistPath}" 2>/dev/null || true`);
        execSync(`launchctl load "${plistPath}"`);
        console.log('✅ LaunchAgent restarted successfully!');
      }
      if (fs.existsSync(daemonPath)) {
        console.log('🚀 Restarting macOS LaunchDaemon to apply config...');
        execSync(`sudo launchctl unload "${daemonPath}" 2>/dev/null || launchctl unload "${daemonPath}" 2>/dev/null || true`);
        execSync(`sudo launchctl load "${daemonPath}" || launchctl load "${daemonPath}"`);
        console.log('✅ LaunchDaemon restarted successfully!');
      }
    } catch (err) {
      console.log('⚠️ Could not auto-restart launchctl daemon/agent. Restart manually.');
    }
  })
  .catch((err) => {
    console.error('❌ Network error connected to local API:', err.message);
    process.exit(1);
  });
}

main();
