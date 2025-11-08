#!/bin/bash

echo "🔧 Fixing Chat Route Issue..."
echo ""

cd /var/www/travel-automation

# Check current PM2 status
echo "1. Checking PM2 status..."
pm2 status

echo ""
echo "2. Checking for view files..."
if [ -d "dist/views" ]; then
    echo "✓ dist/views exists"
    ls -la dist/views/
else
    echo "✗ dist/views missing - creating it"
    mkdir -p dist/views
fi

echo ""
echo "3. Copying view files from src to dist..."
cp -v src/views/*.pug dist/views/ 2>/dev/null || echo "View files might already exist"

echo ""
echo "4. Installing Pug if not already installed..."
npm list pug || npm install pug

echo ""
echo "5. Checking PM2 logs for errors..."
pm2 logs travel-automation --lines 30 --nostream --err

echo ""
echo "6. Restarting application..."
pm2 restart travel-automation

echo ""
echo "7. Waiting for restart..."
sleep 3

echo ""
echo "8. Testing health endpoint..."
curl -s http://localhost:3000/health

echo ""
echo "9. Testing chat endpoint..."
curl -I http://localhost:3000/chat 2>&1 | head -5

echo ""
echo "✅ Done! Now test: http://72.61.102.55/chat"
