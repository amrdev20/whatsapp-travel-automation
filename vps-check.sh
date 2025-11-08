#!/bin/bash

echo "================================================"
echo "  WhatsApp Travel Automation - VPS Health Check"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check PM2
echo "1. Checking PM2 Status..."
if pm2 status | grep -q "travel-automation"; then
    echo -e "${GREEN}✓${NC} PM2 is running travel-automation"
    pm2 status | grep travel-automation
else
    echo -e "${RED}✗${NC} PM2 is not running travel-automation"
fi
echo ""

# Check application directory
echo "2. Checking Application Files..."
cd /var/www/travel-automation || exit 1

if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
else
    echo -e "${RED}✗${NC} .env file missing"
fi

if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} dist/ directory exists"
else
    echo -e "${RED}✗${NC} dist/ directory missing"
fi

if [ -d "dist/views" ]; then
    echo -e "${GREEN}✓${NC} dist/views/ directory exists"
else
    echo -e "${YELLOW}⚠${NC} dist/views/ directory missing (views might not work)"
fi

if [ -d "uploads" ]; then
    echo -e "${GREEN}✓${NC} uploads/ directory exists"
else
    echo -e "${YELLOW}⚠${NC} uploads/ directory missing"
fi
echo ""

# Check Node.js
echo "3. Checking Node.js..."
node --version
npm --version
echo ""

# Test local endpoints
echo "4. Testing Local Endpoints..."

# Health check
HEALTH=$(curl -s http://localhost:3000/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Health endpoint working"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}✗${NC} Health endpoint failed"
fi

# Webhook check
WEBHOOK=$(curl -s "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=offto_whatsapp_2024&hub.challenge=test123")
if [ "$WEBHOOK" = "test123" ]; then
    echo -e "${GREEN}✓${NC} Webhook endpoint working"
else
    echo -e "${RED}✗${NC} Webhook endpoint failed"
    echo "   Expected: test123"
    echo "   Got: $WEBHOOK"
fi
echo ""

# Check nginx
echo "5. Checking Nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${RED}✗${NC} Nginx is not running"
fi

if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓${NC} Nginx config is valid"
else
    echo -e "${RED}✗${NC} Nginx config has errors"
fi
echo ""

# Check recent logs
echo "6. Recent Application Logs (last 10 lines)..."
echo "---"
pm2 logs travel-automation --lines 10 --nostream 2>/dev/null | tail -10
echo "---"
echo ""

# Summary
echo "================================================"
echo "  Summary"
echo "================================================"
echo ""
echo "Application Directory: /var/www/travel-automation"
echo "Health Endpoint: http://72.61.102.55/health"
echo "Webhook URL: http://72.61.102.55/api/whatsapp/webhook"
echo "Verify Token: offto_whatsapp_2024"
echo ""
echo "Useful Commands:"
echo "  pm2 logs travel-automation    - View logs"
echo "  pm2 restart travel-automation - Restart app"
echo "  pm2 monit                     - Monitor resources"
echo ""
