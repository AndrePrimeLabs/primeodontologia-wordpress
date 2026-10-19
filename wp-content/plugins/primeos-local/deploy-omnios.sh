#!/bin/bash

# ============================================================================
# OmniOS Multi-Domain VPS Deployment Script
# ============================================================================
# Deploys both PrimeOS and OmniOS to VPS with multi-tenant API
# Usage: Run on VPS as root
# ============================================================================

set -e

echo "🚀 OMNIOS DEPLOYMENT SCRIPT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="82.29.56.236"
PRIMEOS_DOMAIN="primeos.primeodontologia.com.br"
OMNIOS_DOMAIN="omnios.primeodontologia.com.br"
PROJECT_DIR="/root/primeos-local"

echo -e "${YELLOW}Stage 1: Pre-deployment checks${NC}"
echo "════════════════════════════════════════════════════════════════"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}❌ This script must be run as root${NC}"
   exit 1
fi

echo -e "${GREEN}✅ Running as root${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
   echo -e "${RED}❌ Docker not installed${NC}"
   exit 1
fi
echo -e "${GREEN}✅ Docker installed$(docker --version)${NC}"

# Check git
if ! command -v git &> /dev/null; then
   echo -e "${RED}❌ Git not installed${NC}"
   exit 1
fi
echo -e "${GREEN}✅ Git installed$(git --version | head -1)${NC}"

# Check Nginx
if ! command -v nginx &> /dev/null; then
   echo -e "${RED}❌ Nginx not installed${NC}"
   exit 1
fi
echo -e "${GREEN}✅ Nginx installed${NC}"

# Check Certbot
if ! command -v certbot &> /dev/null; then
   echo -e "${RED}❌ Certbot not installed${NC}"
   exit 1
fi
echo -e "${GREEN}✅ Certbot installed${NC}"

# Check project directory
if [ ! -d "$PROJECT_DIR" ]; then
   echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
   exit 1
fi
echo -e "${GREEN}✅ Project directory exists${NC}"

echo ""
echo -e "${YELLOW}Stage 2: Pull latest code${NC}"
echo "════════════════════════════════════════════════════════════════"

cd "$PROJECT_DIR"
git pull origin main
echo -e "${GREEN}✅ Code pulled from GitHub${NC}"

echo ""
echo -e "${YELLOW}Stage 3: Verify environment files${NC}"
echo "════════════════════════════════════════════════════════════════"

if [ ! -f ".env.production" ]; then
   echo -e "${RED}❌ .env.production not found${NC}"
   exit 1
fi
echo -e "${GREEN}✅ .env.production exists${NC}"

if [ ! -f ".env.omnios" ]; then
   echo -e "${RED}❌ .env.omnios not found${NC}"
   exit 1
fi
echo -e "${GREEN}✅ .env.omnios exists${NC}"

echo ""
echo -e "${YELLOW}Stage 4: Update Nginx configuration${NC}"
echo "════════════════════════════════════════════════════════════════"

# Backup existing config
if [ -f "/etc/nginx/sites-available/primeos" ]; then
   cp /etc/nginx/sites-available/primeos /etc/nginx/sites-available/primeos.backup
   echo -e "${GREEN}✅ Backed up existing Nginx config${NC}"
fi

# Copy new multi-domain config
cp "$PROJECT_DIR/nginx-multi-domain.conf" /etc/nginx/sites-available/primeos
echo -e "${GREEN}✅ Copied multi-domain Nginx config${NC}"

# Test Nginx syntax
if ! nginx -t 2>&1 | grep -q "successful"; then
   echo -e "${RED}❌ Nginx config syntax error${NC}"
   nginx -t
   exit 1
fi
echo -e "${GREEN}✅ Nginx config syntax OK${NC}"

echo ""
echo -e "${YELLOW}Stage 5: Request/verify SSL certificates${NC}"
echo "════════════════════════════════════════════════════════════════"

# Check if certificates exist
if [ -f "/etc/letsencrypt/live/$PRIMEOS_DOMAIN/fullchain.pem" ]; then
   echo -e "${GREEN}✅ PrimeOS certificate exists${NC}"
else
   echo -e "${YELLOW}⚠️  PrimeOS certificate not found, requesting...${NC}"
   certbot certonly --webroot -w /usr/share/nginx/html \
     -d "$PRIMEOS_DOMAIN" --non-interactive --agree-tos -m admin@primeodontologia.com.br || echo "PrimeOS cert may already exist"
fi

if [ -f "/etc/letsencrypt/live/$OMNIOS_DOMAIN/fullchain.pem" ]; then
   echo -e "${GREEN}✅ OmniOS certificate exists${NC}"
else
   echo -e "${YELLOW}⚠️  OmniOS certificate not found, requesting...${NC}"
   certbot certonly --webroot -w /usr/share/nginx/html \
     -d "$OMNIOS_DOMAIN" --non-interactive --agree-tos -m admin@omnios.com.br || echo "OmniOS cert may already exist"
fi

echo ""
echo -e "${YELLOW}Stage 6: Stop existing services${NC}"
echo "════════════════════════════════════════════════════════════════"

cd "$PROJECT_DIR"
docker compose down || true
echo -e "${GREEN}✅ Services stopped${NC}"

echo ""
echo -e "${YELLOW}Stage 7: Build Docker images${NC}"
echo "════════════════════════════════════════════════════════════════"

docker compose build --no-cache
echo -e "${GREEN}✅ Docker images built${NC}"

echo ""
echo -e "${YELLOW}Stage 8: Start all services${NC}"
echo "════════════════════════════════════════════════════════════════"

docker compose up -d
sleep 5

# Verify services
if docker compose ps | grep -q "primeos-app.*Up"; then
   echo -e "${GREEN}✅ primeos-app running${NC}"
else
   echo -e "${RED}❌ primeos-app not running${NC}"
fi

if docker compose ps | grep -q "omnios-app.*Up"; then
   echo -e "${GREEN}✅ omnios-app running${NC}"
else
   echo -e "${RED}❌ omnios-app not running${NC}"
fi

if docker compose ps | grep -q "primeos-api-server.*Up"; then
   echo -e "${GREEN}✅ primeos-api-server running${NC}"
else
   echo -e "${RED}❌ primeos-api-server not running${NC}"
fi

echo ""
echo -e "${YELLOW}Stage 9: Reload Nginx${NC}"
echo "════════════════════════════════════════════════════════════════"

systemctl reload nginx
echo -e "${GREEN}✅ Nginx reloaded${NC}"

echo ""
echo -e "${YELLOW}Stage 10: Verification${NC}"
echo "════════════════════════════════════════════════════════════════"

echo ""
echo "Testing PrimeOS:"
if curl -s -k https://localhost/health | grep -q "ok"; then
   echo -e "${GREEN}✅ PrimeOS health check passed${NC}"
else
   echo -e "${RED}❌ PrimeOS health check failed${NC}"
fi

echo ""
echo "Testing OmniOS:"
if curl -s -k https://localhost/health -H "X-Tenant-ID: omnios" | grep -q "ok"; then
   echo -e "${GREEN}✅ OmniOS health check passed${NC}"
else
   echo -e "${RED}❌ OmniOS health check failed${NC}"
fi

echo ""
echo "Docker services:"
docker compose ps

echo ""
echo -e "${YELLOW}Stage 11: Display logs${NC}"
echo "════════════════════════════════════════════════════════════════"

echo ""
echo "Last 20 lines of API logs:"
docker compose logs primeos-api | tail -20

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"

echo ""
echo "📊 Deployment Summary:"
echo "  PrimeOS:  https://$PRIMEOS_DOMAIN"
echo "  OmniOS:   https://$OMNIOS_DOMAIN"
echo "  API:      Ports 5001 (PrimeOS) + 5002 (OmniOS)"
echo ""
echo "🔗 Test endpoints:"
echo "  curl https://$PRIMEOS_DOMAIN/health"
echo "  curl https://$OMNIOS_DOMAIN/health"
echo ""
echo "📋 View logs:"
echo "  docker compose logs -f primeos-api"
echo ""
echo "🔄 Next steps:"
echo "  1. Verify DNS resolution: nslookup omnios.omnios.com.br"
echo "  2. Test in browser: https://$OMNIOS_DOMAIN"
echo "  3. Test API: curl -H 'Authorization: Bearer \$TOKEN' https://$OMNIOS_DOMAIN/api/status"
echo ""
