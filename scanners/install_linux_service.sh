#!/bin/bash
# ITAM Scanner - Linux Systemd Service Installation Script

set -e

SERVICE_NAME="itam-scanner"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="${SCRIPT_DIR}/itam_scanner.py"
PYTHON_BIN="/usr/bin/python3"
LOG_DIR="${SCRIPT_DIR}/logs"

echo "========================================"
echo "ITAM Scanner Linux Service Installer"
echo "========================================"
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed!"
    echo "Install with: sudo apt install python3 python3-pip"
    exit 1
fi

# Check if script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "ERROR: Scanner script not found at $SCRIPT_PATH"
    exit 1
fi

# Install required Python packages
echo "Installing required Python packages..."
pip3 install -r "${SCRIPT_DIR}/requirements.txt" || {
    echo "ERROR: Failed to install Python packages!"
    exit 1
}

# Create logs directory
mkdir -p "$LOG_DIR"
chown -R $(logname):$(logname) "$LOG_DIR"

# Stop existing service if running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Stopping existing service..."
    systemctl stop "$SERVICE_NAME"
fi

# Create systemd service file
echo "Creating systemd service file..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ITAM Asset Scanner Service
Documentation=https://github.com/yourusername/itam
After=network.target

[Service]
Type=simple
User=$(logname)
Group=$(logname)
WorkingDirectory=${SCRIPT_DIR}
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=${PYTHON_BIN} ${SCRIPT_PATH}
Restart=always
RestartSec=10
StandardOutput=append:${LOG_DIR}/service.log
StandardError=append:${LOG_DIR}/service.log

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${SCRIPT_DIR}/logs

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chmod 644 "$SERVICE_FILE"

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable service to start on boot
echo "Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

# Start service
echo "Starting service..."
systemctl start "$SERVICE_NAME"

# Check status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo
    echo "========================================"
    echo "Service installed and started successfully!"
    echo "========================================"
    echo
    echo "Service Name: $SERVICE_NAME"
    echo "Status: Running"
    echo "Log File: ${LOG_DIR}/service.log"
    echo
    echo "Useful commands:"
    echo "  View status:  sudo systemctl status $SERVICE_NAME"
    echo "  View logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo "  Stop service: sudo systemctl stop $SERVICE_NAME"
    echo "  Start service: sudo systemctl start $SERVICE_NAME"
    echo "  Restart:      sudo systemctl restart $SERVICE_NAME"
    echo "  Disable:      sudo systemctl disable $SERVICE_NAME"
    echo "  Uninstall:    sudo bash uninstall_linux_service.sh"
    echo
else
    echo "ERROR: Service failed to start!"
    echo "Check status with: sudo systemctl status $SERVICE_NAME"
    echo "View logs with: sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
