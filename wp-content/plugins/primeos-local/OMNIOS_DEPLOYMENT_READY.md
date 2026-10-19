# 🚀 OMNIOS DEPLOYMENT - EXECUTE NOW

**Status:** Ready to deploy  
**Date:** 2026-09-25  
**Deployment:** Automated script

---

## Quick Deployment (1 Command)

### On your local machine:

```bash
# Copy deployment script to VPS and execute
sshpass -p 'Dentista2027..' ssh -o StrictHostKeyChecking=no root@82.29.56.236 << 'DEPLOY'
cd /root/primeos-local
git pull origin main
chmod +x deploy-omnios.sh
./deploy-omnios.sh
DEPLOY
```

---

## Manual Deployment (Step-by-Step)

If you prefer to run commands manually:

### Step 1: SSH into VPS

```bash
ssh root@82.29.56.236
# Password: Dentista2027..
```

### Step 2: Navigate to project

```bash
cd /root/primeos-local
git pull origin main
```

### Step 3: Run deployment script

```bash
chmod +x deploy-omnios.sh
./deploy-omnios.sh
```

---

## What the script does:

1. ✅ Verifies all dependencies (Docker, Nginx, Certbot)
2. ✅ Pulls latest code from GitHub
3. ✅ Verifies environment files
4. ✅ Updates Nginx with multi-domain config
5. ✅ Requests SSL certificates (if needed)
6. ✅ Stops existing services
7. ✅ Builds new Docker images
8. ✅ Starts all services (primeos-app, omnios-app, api)
9. ✅ Reloads Nginx
10. ✅ Verifies everything works
11. ✅ Displays logs and summary

---

## Expected Output:

```
🚀 OMNIOS DEPLOYMENT SCRIPT
════════════════════════════════════════════════════════════════

Stage 1: Pre-deployment checks
════════════════════════════════════════════════════════════════
✅ Running as root
✅ Docker installed
✅ Git installed
✅ Nginx installed
✅ Certbot installed
✅ Project directory exists

Stage 2: Pull latest code
════════════════════════════════════════════════════════════════
✅ Code pulled from GitHub

[... more stages ...]

✅ DEPLOYMENT COMPLETE
════════════════════════════════════════════════════════════════

📊 Deployment Summary:
  PrimeOS:  https://primeos.primeodontologia.com.br
  OmniOS:   https://omnios.omnios.com.br
  API:      Ports 5001 (PrimeOS) + 5002 (OmniOS)
```

---

## Post-Deployment Verification

After script completes, run these tests:

### Test 1: DNS Resolution

```bash
nslookup omnios.omnios.com.br
# Should return: 82.29.56.236
```

### Test 2: HTTPS Connection

```bash
curl -I https://primeos.primeodontologia.com.br
curl -I https://omnios.omnios.com.br
# Should return: 200 OK with SSL certificate
```

### Test 3: Health Endpoints

```bash
curl https://primeos.primeodontologia.com.br/health
curl https://omnios.omnios.com.br/health
# Should return: {"status":"ok",...}
```

### Test 4: API Status

```bash
curl https://primeos.primeodontologia.com.br/api/status
curl https://omnios.omnios.com.br/api/status
# Should return tenant info
```

### Test 5: Security Headers

```bash
curl -I https://primeos.primeodontologia.com.br | grep -E "Strict-Transport|X-Frame"
curl -I https://omnios.omnios.com.br | grep -E "Strict-Transport|X-Frame"
# Should show security headers
```

---

## Troubleshooting

### Issue: "DNS record not resolving"
- Wait 5-10 minutes for DNS propagation
- Verify A record was added: `nslookup omnios.omnios.com.br`

### Issue: "SSL certificate error"
- Check: `sudo certbot certificates`
- Renew manually: `sudo certbot renew --force-renewal`

### Issue: "Services not starting"
- Check logs: `docker compose logs primeos-api`
- Check Docker status: `docker ps -a`
- Rebuild: `docker compose build --no-cache && docker compose up -d`

### Issue: "Nginx error"
- Check syntax: `sudo nginx -t`
- Check status: `sudo systemctl status nginx`
- Reload: `sudo systemctl reload nginx`

---

## Monitor Services

After deployment:

```bash
# SSH to VPS
ssh root@82.29.56.236

# Watch services
docker compose ps

# View logs
docker compose logs -f primeos-api

# Check resource usage
docker stats

# Check Nginx
sudo tail -f /var/log/nginx/access.log | grep -E "primeos|omnios"
```

---

## Ready to Deploy?

**Choose one:**

### Option A: One-liner (fastest)
```bash
sshpass -p 'Dentista2027..' ssh -o StrictHostKeyChecking=no root@82.29.56.236 "cd /root/primeos-local && git pull origin main && chmod +x deploy-omnios.sh && ./deploy-omnios.sh"
```

### Option B: Manual steps (if you prefer)
```bash
ssh root@82.29.56.236
cd /root/primeos-local
git pull origin main
./deploy-omnios.sh
```

---

**Let me know when you're ready to deploy!** 👍
