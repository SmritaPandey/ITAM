# QS Discovery Agent (Desktop)

Electron system-tray wrapper around the Node discovery agent (`agent/qs-discovery-agent.js`).

## Features

- Tray menu: **Online / Offline / Paused**, last heartbeat, Open Status Dashboard, Pause/Resume, Quit
- Spawns the discovery agent with `--silent` (no auto browser popup)
- Reads `agent/config.json` when present (server, credentials, token)
- Auto-starts on login (`auto-launch`)
- Hidden from Dock (macOS) / taskbar when status window is minimized to tray
- Packaged builds for Windows (NSIS), macOS (DMG), Linux (AppImage)

## Run (development)

From this directory:

```bash
npm install
npm start
```

Requires Node.js on `PATH` (or the app falls back to Electron’s Node via `ELECTRON_RUN_AS_NODE`).

Configure the agent first — create or edit `../../agent/config.json`:

```json
{
  "server": "http://localhost:4100",
  "email": "user@example.com",
  "password": "your-password"
}
```

## Status Dashboard

- Prefer the agent’s local dashboard at [http://localhost:49152/](http://localhost:49152/)
- If the agent dashboard is not up yet, tray → **Open Status Dashboard** shows a small Electron status window

## Build installers

```bash
npm run dist        # current platform
npm run dist:win    # NSIS .exe
npm run dist:mac    # .dmg
npm run dist:linux  # .AppImage
```

Artifacts land in `dist/`. Packaged builds ship `qs-discovery-agent.js` under `resources/agent/`. Place `config.json` next to that script on the target machine (same folder as the packaged agent).

## Workspace

This package lives under `apps/agent-desktop` and is included by the root workspace glob `"apps/*"`.
