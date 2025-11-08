#!/bin/bash
# Quick fix for chat route - Run this on your VPS

cd /var/www/travel-automation

echo "=== Fixing Chat Route Issue ==="
echo ""

# 1. Ensure dist/views exists
mkdir -p dist/views

# 2. Copy view files
cp src/views/*.pug dist/views/ 2>/dev/null
echo "✓ View files copied"

# 3. Install pug
npm install pug
echo "✓ Pug installed"

# 4. Restart PM2
pm2 restart travel-automation
echo "✓ PM2 restarted"

sleep 2

# 5. Test
echo ""
echo "=== Testing Endpoints ==="
curl -s http://localhost:3000/health
echo ""
curl -I http://localhost:3000/chat 2>&1 | grep "HTTP"

echo ""
echo "=== Recent Logs ==="
pm2 logs travel-automation --lines 10 --nostream

echo ""
echo "✅ Done! Test at: http://72.61.102.55/chat"
