#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — macOS Native Application Bundle Generator
# ═══════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="QS-Discovery-Agent"
APP_DIR="${SCRIPT_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MAC_OS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

echo "🍏 Generating native macOS Application Bundle..."
echo ""

# Cleanup previous build
rm -rf "${APP_DIR}"

# Create directories
mkdir -p "${MAC_OS_DIR}"
mkdir -p "${RESOURCES_DIR}"

# Compile app.icns if icon.png is present
if [ -f "${SCRIPT_DIR}/icon.png" ]; then
  echo "🎨 Compiling premium app.icns bundle from icon.png..."
  ICONSET_DIR="${SCRIPT_DIR}/icon.iconset"
  mkdir -p "${ICONSET_DIR}"
  
  sips -z 16 16     "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_16x16.png" &>/dev/null
  sips -z 32 32     "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_16x16@2x.png" &>/dev/null
  sips -z 32 32     "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_32x32.png" &>/dev/null
  sips -z 64 64     "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_32x32@2x.png" &>/dev/null
  sips -z 128 128   "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_128x128.png" &>/dev/null
  sips -z 256 256   "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_128x128@2x.png" &>/dev/null
  sips -z 256 256   "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_256x256.png" &>/dev/null
  sips -z 512 512   "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_256x256@2x.png" &>/dev/null
  sips -z 512 512   "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_512x512.png" &>/dev/null
  sips -z 1024 1024 "${SCRIPT_DIR}/icon.png" --out "${ICONSET_DIR}/icon_512x512@2x.png" &>/dev/null
  
  iconutil -c icns "${ICONSET_DIR}" --o "${RESOURCES_DIR}/app.icns"
  rm -rf "${ICONSET_DIR}"
  echo "✅ app.icns compiled successfully."
fi

# Create Info.plist with background daemon preferences
cat <<EOF > "${CONTENTS_DIR}/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>QS Discovery Agent</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>app.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.qsasset.discovery.agent</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>QS Discovery Agent</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>LSBackgroundOnly</key>
    <true/>
</dict>
</plist>
EOF

# Copy agent files directly inside the self-contained application bundle
cp "${SCRIPT_DIR}/qs-discovery-agent.js" "${MAC_OS_DIR}/"
cp "${SCRIPT_DIR}/run-agent.sh" "${MAC_OS_DIR}/"
cp "${SCRIPT_DIR}/Status Dashboard.html" "${MAC_OS_DIR}/"
[ -f "${SCRIPT_DIR}/setup.html" ] && cp "${SCRIPT_DIR}/setup.html" "${MAC_OS_DIR}/"
[ -f "${SCRIPT_DIR}/QuickStart.txt" ] && cp "${SCRIPT_DIR}/QuickStart.txt" "${MAC_OS_DIR}/"
chmod +x "${MAC_OS_DIR}/run-agent.sh"

# Create launcher script
cat <<'EOF' > "${MAC_OS_DIR}/launcher"
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"
./run-agent.sh > ../Resources/agent-service.log 2> ../Resources/agent-service-error.log &
EOF

chmod +x "${MAC_OS_DIR}/launcher"

echo "✅ Native macOS Application Bundle generated: ${APP_NAME}.app"
echo "📡 Double-clicking this app bundle will launch the telemetry agent silently in the background."
echo ""

