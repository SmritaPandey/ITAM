#!/usr/bin/env bash
set -euo pipefail

APP_NAME="onprem-asset"
INSTALL_DIR="/opt/${APP_NAME}"
DATA_DIR="/var/lib/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

echo "Installing ${APP_NAME}..."

sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
sudo cp -r backend "$INSTALL_DIR/"
sudo cp -r frontend "$INSTALL_DIR/"
sudo cp -r packaging/linux/${APP_NAME}.service "$SERVICE_FILE"

cd "$INSTALL_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --no-cache-dir -r requirements.txt

mkdir -p "$DATA_DIR/attachments"
mkdir -p "$DATA_DIR/db"

if ! id -u ${APP_NAME} >/dev/null 2>&1; then
  sudo useradd --system --home "$INSTALL_DIR" --shell /sbin/nologin ${APP_NAME}
fi
sudo chown -R ${APP_NAME}:${APP_NAME} "$INSTALL_DIR" "$DATA_DIR"

sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}
sudo systemctl start ${APP_NAME}

echo "Installed. Service: ${APP_NAME}. Visit http://<host>/"

