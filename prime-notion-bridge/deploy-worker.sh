#!/usr/bin/env bash
# ==============================================================================
# Prime Odontologia — Notion CMS Sync Worker VPS Installer
# Target Server: Hostinger VPS (82.29.56.236)
# ==============================================================================

set -euo pipefail

INSTALL_DIR="/opt/prime-notion-bridge"
SERVICE_NAME="prime-notion-sync"
REPO_URL="https://github.com/AndrePrimeLabs/primeodontologia-wordpress.git"

echo "=========================================================="
echo " Dental Prime — Deploying Notion Sync Worker Daemon"
echo "=========================================================="

# 1. Ensure required system packages (curl, git)
if ! command -v git &> /dev/null || ! command -v curl &> /dev/null; then
  echo "📦 Installing system prerequisites..."
  apt-get update -y && apt-get install -y git curl
fi

# 2. Ensure Node.js (v20+ or v22 LTS)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo "📦 Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

NODE_BIN="$(which node)"
echo "✅ Node.js runtime: ${NODE_BIN} ($(node -v))"

# Ensure /usr/bin/node symlink exists for systemd
if [ "${NODE_BIN}" != "/usr/bin/node" ]; then
  ln -sf "${NODE_BIN}" /usr/bin/node
fi

# 3. Clone or pull the repository
if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "🔄 Updating existing repository in ${INSTALL_DIR}..."
  cd "${INSTALL_DIR}"
  git fetch origin main
  git reset --hard origin/main
else
  echo "📥 Cloning repository to ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}"
  git clone "${REPO_URL}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
fi

# 4. Install npm dependencies if package.json exists
if [ -f "${INSTALL_DIR}/package.json" ]; then
  echo "📦 Installing dependencies..."
  npm install --production --silent
fi

# 5. Configure environment (.env)
ENV_FILE="${INSTALL_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  echo "⚙️ Creating default ${ENV_FILE}..."
  cat << EOF > "${ENV_FILE}"
NOTION_TOKEN="${NOTION_TOKEN:-}"
NOTION_DATABASE_ID="${NOTION_DATABASE_ID:-ee4c3317-8621-4c88-8a82-33acd677bbea}"
NOTION_API_VERSION="2022-06-28"
WP_BASE_URL="${WP_BASE_URL:-https://primeodontologia.com.br}"
WP_USER="${WP_USER:-admin}"
WP_APP_PASSWORD="${WP_APP_PASSWORD:-}"
SYNC_PUBLISH_MODE="direct"
EOF
  echo "⚠️ Generated ${ENV_FILE}."
fi

# 6. Install systemd service
SERVICE_SRC="${INSTALL_DIR}/prime-notion-bridge/prime-notion-sync.service"
SERVICE_DST="/etc/systemd/system/${SERVICE_NAME}.service"

if [ -f "${SERVICE_SRC}" ]; then
  cp "${SERVICE_SRC}" "${SERVICE_DST}"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
  echo "✅ Systemd service installed and started: ${SERVICE_NAME}"
else
  echo "❌ Error: Service template not found at ${SERVICE_SRC}"
  exit 1
fi

echo ""
echo "=========================================================="
echo "🎉 Worker Deployed Successfully!"
echo "Check status:  systemctl status ${SERVICE_NAME}"
echo "Live logs:     journalctl -u ${SERVICE_NAME} -f"
echo "=========================================================="
