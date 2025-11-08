# Deployment Verification Guide

## Step 1: Connect to VPS

```bash
ssh root@72.61.102.55
# Password: ALpatchino5575@
```

## Step 2: Check PM2 Status

```bash
pm2 status
pm2 logs travel-automation --lines 50
```

## Step 3: Verify Files

```bash
cd /var/www/travel-automation
ls -la

# Check if these exist:
# - .env file
# - dist/ directory
# - src/ directory
# - node_modules/ directory
# - uploads/ directory
```

## Step 4: Test Endpoints Locally

```bash
# Health check
curl http://localhost:3000/health

# Webhook verification
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=offto_whatsapp_2024&hub.challenge=test123"

# Should return: test123
```

## Step 5: Test From Outside

From your local machine:
```bash
curl http://72.61.102.55/health
curl "http://72.61.102.55/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=offto_whatsapp_2024&hub.challenge=test123"
```

## Step 6: Check Nginx

```bash
# Check nginx status
systemctl status nginx

# Check nginx config
nginx -t

# View nginx logs
tail -50 /var/log/nginx/error.log
```

## Step 7: Verify Environment Variables

```bash
cat .env | grep -v "API_KEY"
# Should show all your config except sensitive keys
```

## Common Issues & Fixes

### If PM2 is not running:
```bash
cd /var/www/travel-automation
pm2 start dist/index.js --name travel-automation
pm2 save
```

### If views are missing:
```bash
mkdir -p dist/views
cp src/views/*.pug dist/views/
pm2 restart travel-automation
```

### If uploads directory missing:
```bash
mkdir -p uploads
chmod 755 uploads
```

### If dotenv not loading:
```bash
# Check first line of dist/index.js
head -1 dist/index.js
# Should show: require("dotenv").config();
```

### If it's not, add it:
```bash
sed -i '1s/^/require("dotenv").config();\n/' dist/index.js
pm2 restart travel-automation
```

## WhatsApp Configuration

Once everything is verified, configure your Meta WhatsApp webhook:

1. Go to: https://developers.facebook.com/apps/
2. Select your app
3. Go to WhatsApp > Configuration
4. Set Callback URL: `http://72.61.102.55/api/whatsapp/webhook`
5. Set Verify Token: `offto_whatsapp_2024`
6. Subscribe to `messages` webhook field

## Test WhatsApp Integration

Send a message to your WhatsApp Business number:
```
Hello
```

You should receive an automated response!

## Monitoring

```bash
# Watch logs in real-time
pm2 logs travel-automation

# View specific errors
pm2 logs travel-automation --err

# Restart if needed
pm2 restart travel-automation

# Check memory/CPU usage
pm2 monit
```
