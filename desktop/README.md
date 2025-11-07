# ITAM Enterprise - Desktop Application

Native desktop application for IT Asset Management, built with Electron.

## Features

- 🖥️ **Native Desktop Experience**: Full-featured desktop app for Windows, macOS, and Linux
- 🔄 **Auto-Updates**: Automatic application updates
- 🌐 **Offline Capable**: Work offline with local data synchronization
- 🔔 **System Notifications**: Native system notifications for alerts
- 🎨 **System Tray Integration**: Minimize to system tray for quick access
- ⚙️ **Configurable**: Customizable server URL and application settings
- 🔒 **Secure**: Sandboxed environment with context isolation

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
cd desktop
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This will start the Electron app and connect to your local development server (http://localhost:3001).

### Build for Production

```bash
# Build for current platform
npm run build

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux

# Build for all platforms
npm run build:all
```

## Installation

### Windows

1. Download the installer: `ITAM-Enterprise-1.0.0-x64.exe`
2. Run the installer and follow the setup wizard
3. Launch from Start Menu or Desktop shortcut

**Portable Version:**
- Download `ITAM-Enterprise-1.0.0-x64.exe` (portable)
- Run directly without installation

### macOS

1. Download the DMG: `ITAM-Enterprise-1.0.0-x64.dmg`
2. Open the DMG file
3. Drag ITAM Enterprise to Applications folder
4. Launch from Applications

**Apple Silicon (M1/M2):**
- Download `ITAM-Enterprise-1.0.0-arm64.dmg`

### Linux

**AppImage (Universal):**
```bash
chmod +x ITAM-Enterprise-1.0.0-x64.AppImage
./ITAM-Enterprise-1.0.0-x64.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i itam-enterprise_1.0.0_amd64.deb
```

**Red Hat/Fedora:**
```bash
sudo rpm -i itam-enterprise-1.0.0.x86_64.rpm
```

## Configuration

### Server URL

The desktop app needs to connect to your ITAM server. You can configure this in Settings:

1. Click **File** → **Settings**
2. Enter your server URL (e.g., `https://itam.yourcompany.com`)
3. Click **Save**

### Auto-Launch

Enable auto-launch to start ITAM Enterprise on system startup:

1. Open Settings
2. Enable **Launch on Startup**
3. The app will start automatically when you log in

### System Tray

The app can minimize to the system tray instead of the taskbar:

1. Open Settings
2. Enable **Minimize to Tray**
3. Close the main window to minimize to tray

## Features

### Automatic Updates

The desktop app automatically checks for updates and notifies you when a new version is available. You can also manually check for updates:

1. Click **Help** → **Check for Updates**
2. If an update is available, you'll be prompted to download and install

### Keyboard Shortcuts

- `Ctrl/Cmd + ,`: Open Settings
- `Ctrl/Cmd + Q`: Quit Application
- `Ctrl/Cmd + R`: Reload
- `Ctrl/Cmd + Shift + R`: Force Reload
- `F11`: Toggle Fullscreen
- `Ctrl/Cmd + +/-/0`: Zoom In/Out/Reset

### Offline Mode

The desktop app caches data locally, allowing you to:
- View previously loaded assets
- Work with data offline
- Automatic synchronization when connection is restored

## Troubleshooting

### Windows

**Issue: Windows Defender SmartScreen warning**
- This is normal for new applications
- Click "More info" → "Run anyway"
- The warning will disappear after the app gains reputation

**Issue: App won't start**
- Check Windows Event Viewer for errors
- Try running as Administrator
- Reinstall the application

### macOS

**Issue: "ITAM Enterprise" cannot be opened because it is from an unidentified developer**
- Open System Preferences → Security & Privacy
- Click "Open Anyway" at the bottom
- Or right-click app → Open → Open

**Issue: App crashes on startup**
- Check Console.app for crash logs
- Try removing `~/Library/Application Support/itam-enterprise-desktop`
- Reinstall the application

### Linux

**Issue: AppImage won't execute**
```bash
chmod +x ITAM-Enterprise-*.AppImage
```

**Issue: Missing dependencies (Ubuntu/Debian)**
```bash
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
```

**Issue: Tray icon not showing**
- Install a system tray extension (GNOME Shell users)
- Some desktop environments don't support tray icons

### General Issues

**Clear Application Cache:**
- Windows: `%APPDATA%\itam-enterprise-desktop`
- macOS: `~/Library/Application Support/itam-enterprise-desktop`
- Linux: `~/.config/itam-enterprise-desktop`

**Reset Settings:**
Delete the `config.json` file from the application data directory.

**Enable Debug Logging:**
1. Set environment variable: `DEBUG=*`
2. Logs are saved to the application data directory

## Building from Source

### Requirements

- Node.js 18+
- Git

### Clone and Build

```bash
git clone <repository-url>
cd desktop
npm install
npm run build
```

### Code Signing (for distribution)

**Windows:**
```bash
# Set certificate environment variables
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=certificate-password
npm run build:win
```

**macOS:**
```bash
# Set Apple Developer credentials
export APPLE_ID=your-apple-id@example.com
export APPLE_ID_PASSWORD=app-specific-password
npm run build:mac
```

**Linux:**
- No code signing required

## Architecture

```
desktop/
├── main.js           # Main Electron process
├── preload.js        # Preload script (context bridge)
├── package.json      # Dependencies and build config
├── assets/           # Application icons and resources
└── renderer/         # Renderer process files
    └── error.html    # Error page
```

## Development Tips

### Hot Reload

The app automatically reloads when connected to a development server with hot reload enabled.

### DevTools

Press `Ctrl/Cmd + Shift + I` to open Chrome DevTools in development mode.

### Logging

All logs are saved to:
- Windows: `%USERPROFILE%\AppData\Roaming\itam-enterprise-desktop\logs`
- macOS: `~/Library/Logs/itam-enterprise-desktop`
- Linux: `~/.config/itam-enterprise-desktop/logs`

## Security

The desktop app implements several security measures:

- Context isolation enabled
- Node integration disabled
- Web security enabled
- External URLs open in default browser
- No eval() or similar dangerous functions

## License

Proprietary - ITAM Enterprise

## Support

For issues and support:
- GitHub Issues: https://github.com/yourusername/itam-enterprise/issues
- Email: support@yourdomain.com
- Documentation: https://docs.yourdomain.com
