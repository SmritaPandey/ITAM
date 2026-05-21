async function main() {
  const SERVER = 'http://localhost:4100';
  const API_BASE = `${SERVER}/api/v1`;

  try {
    console.log('🔑 Attempting Login...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@acme.com',
        password: 'Admin@123',
      }),
    });

    const loginData = await loginRes.json() as any;
    const token = loginData.accessToken || loginData.access_token;
    console.log('✅ Authenticated successfully, token length:', token?.length);

    const payload = {
      hostname: 'Smritas-MacBook-Pro.local',
      platform: 'darwin',
      agentVersion: '1.1.0',
      ipAddress: '192.168.1.2',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      systemInfo: {
        hardware: {
          cpuModel: 'Apple M1',
          cpuCores: 8,
          totalRamMb: 16384,
          freeRamMb: 8192,
          usedRamMb: 8192,
          ramUsagePercent: 50,
          diskDrives: [],
        },
        operatingSystem: {
          platform: 'darwin',
          type: 'Darwin',
          release: '20.6.0',
          arch: 'arm64',
          hostname: 'Smritas-MacBook-Pro.local',
          uptime: 1000,
          uptimeHours: 0,
        },
        network: {
          interfaces: [],
          hostname: 'Smritas-MacBook-Pro.local',
        },
        performance: {
          loadAvg1m: '1.00',
          loadAvg5m: '1.00',
          loadAvg15m: '1.00',
          cpuUsagePercent: 12,
        },
        security: {
          firewallEnabled: true,
          encryptionEnabled: true,
          users: ['smrita'],
          activeShellUsers: ['smrita'],
          failedLoginsCount: 0,
          openPorts: [],
        },
        software: [],
        processes: [
          { user: 'smrita', pid: '42636', cpu: '0.0', mem: '0.1', command: 'node -e setInterval(() => {}, 1000) wireshark' }
        ],
        usbDevices: [],
        services: [],
      }
    };

    console.log('📡 Registering agent via HTTP...');
    const registerRes = await fetch(`${API_BASE}/discovery/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('HTTP Status:', registerRes.status);
    const registerText = await registerRes.text();
    console.log('HTTP Response:', registerText);

  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
}

main();
