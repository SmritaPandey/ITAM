#!/bin/bash
# ITAM Scanner - Linux Systemd Service Uninstallation Script

set -e

SERVICE_NAME="itam-scanner"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "========================================"
echo "ITAM Scanner Linux Service Uninstaller"
echo "========================================"
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)"
    exit 1
fi

# Check if service exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Service $SERVICE_NAME is not installed."
    exit 0
fi

# Stop service
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Stopping service..."
    systemctl stop "$SERVICE_NAME"
fi

# Disable service
if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    echo "Disabling service..."
    systemctl disable "$SERVICE_NAME"
fi

# Remove service file
echo "Removing service file..."
rm -f "$SERVICE_FILE"

# Reload systemd daemon
systemctl daemon-reload

echo
echo "========================================"
echo "Service uninstalled successfully!"
echo "========================================"
echo
