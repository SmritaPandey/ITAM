#!/usr/bin/env bash
set -euo pipefail

APP_NAME="onprem-asset"
INSTALL_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

echo "Installing ${APP_NAME} (offline bundle)..."

sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
sudo cp -r ./onprem-asset/backend "$INSTALL_DIR/"
sudo cp ./onprem-asset/onprem-asset.service "$SERVICE_FILE"

sudo mkdir -p "$DATA_DIR/attachments"
sudo touch "$DATA_DIR/asset.db"

if ! id -u ${APP_NAME} >/dev/null 2>&1; then
  sudo useradd --system --home "$INSTALL_DIR" --shell /sbin/nologin ${APP_NAME}
fi
sudo chown -R ${APP_NAME}:${APP_NAME} "$INSTALL_DIR" "$DATA_DIR"

sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}
sudo systemctl start ${APP_NAME}

echo "Installed. Visit http://<host>:8080/"

