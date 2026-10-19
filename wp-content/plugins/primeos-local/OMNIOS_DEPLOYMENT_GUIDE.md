# 🚀 OmniOS Multi-Domain Deployment Guide

**Status:** Ready for VPS Deployment  
**Date:** 2026-09-25  
**Domains:** 
- primeos.primeodontologia.com.br
- omnios.primeodontologia.com.br

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)            │
│        Handles HTTPS, routing, security             │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
    ┌──────▼─────┐            ┌──────▼─────┐
    │  primeos*  │            │  omnios*   │
    │  :8080     │            │  :8081     │
    │ (Frontend) │            │ (Frontend) │
    └──────┬─────┘            └──────┬─────┘
           │                         │
           └──────────────┬──────────┘
                          │
            ┌─────────────▼──────────────┐
            │  Multi-Tenant API Server   │
            │     (Node.js Express)      │
            │      Ports: 5001 + 5002    │
            │                            │
            │  Tenant Detection:         │
            │  - By hostname             │
            │  - By X-Tenant-ID header   │
            └─────────────┬──────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
      ┌────▼──────────┐         ┌───────▼────────┐
      │  PrimeOS DB   │         │  OmniOS DB     │
      │   Supabase    │         │   Supabase     │
      │ (foeahubn...) │         │ (evqjnfh...) │
      └───────────────┘         └────────────────┘
```

---

## Pre-Deployment Checklist

### DNS Setup (⏳ Pending)

- [ ] Add A record: `omnios.primeodontologia.com.br` → `82.29.56.236`
- [ ] Verify DNS propagation: `nslookup omnios.primeodontologia.com.br`
- [ ] Verify DNS propagation: `nslookup primeos.primeodontologia.com.br`

### Credentials Ready

- [x] PrimeOS Supabase: `foeahubnrbclbelsqikp`
- [x] OmniOS Supabase: `evqjnfhnajuvwjqcthhf`
- [x] Both URLs configured in `.env` files

### Local Testing (Optional)

```bash
# Test locally first
docker compose up -d
curl http://localhost:8080/health
curl http://localhost:8081/health
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/status
curl -H "Authorization: Bearer $TOKEN" http://localhost:5002/api/status
```

---

## VPS Deployment Steps

### Step 1: Pull Latest Code from GitHub

```bash
ssh root@82.29.56.236
cd /root/primeos-local
git pull origin main

# Result: Should see new files
# - nginx-multi-domain.conf
# - .env.omnios
# - Updated api/server.js
# - Updated docker-compose.yml
```

### Step 2: Update Environment Variables

```bash
ssh root@82.29.56.236
cd /root/primeos-local

# Edit .env.production (update if needed)
nano .env.production
# Keep existing PrimeOS credentials

# The .env.omnios should already be in git
cat .env.omnios
# Verify OmniOS credentials are present
```

### Step 3: Copy Nginx Configuration

```bash
ssh root@82.29.56.236

# Backup existing config
sudo cp /etc/nginx/sites-available/primeos /etc/nginx/sites-available/primeos.backup

# Copy new multi-domain config
sudo cp /root/primeos-local/nginx-multi-domain.conf /etc/nginx/sites-available/primeos

# Test Nginx syntax
sudo nginx -t
# Expected: "syntax is ok"

# Reload Nginx
sudo systemctl reload nginx
```

### Step 4: Request SSL Certificates

```bash
# For omnios domain (if not already present)
sudo certbot certonly --webroot -w /usr/share/nginx/html \
  -d omnios.primeodontologia.com.br \
  -d primeos.primeodontologia.com.br

# Or use auto-renewal if already set up
sudo certbot renew --dry-run
```

### Step 5: Build and Deploy Docker Services

```bash
ssh root@82.29.56.236
cd /root/primeos-local

# Stop existing services
docker compose down

# Rebuild all images
docker compose build --no-cache

# Start all services
docker compose up -d

# Verify all services running
docker compose ps

# Expected output:
# - primeos-app (port 8080)
# - omnios-app (port 8081)
# - primeos-api-server (ports 5001, 5002)
```

### Step 6: Verify Deployment

```bash
# Check health endpoints
curl https://primeos.primeodontologia.com.br/health
# Expected: {"status":"ok","tenant":"PrimeOS",...}

curl https://omnios.primeodontologia.com.br/health
# Expected: {"status":"ok","tenant":"OmniOS",...}

# Check API status (public endpoints)
curl https://primeos.primeodontologia.com.br/api/status
curl https://omnios.primeodontologia.com.br/api/status

# View logs
docker compose logs primeos-api | tail -50
```

### Step 7: Test Protected Endpoints

```bash
# Get auth token from frontend
# Then test:
curl -H "Authorization: Bearer $TOKEN" \
  https://primeos.primeodontologia.com.br/api/entities/customers

curl -H "Authorization: Bearer $TOKEN" \
  https://omnios.primeodontologia.com.br/api/entities/customers

# Both should return data from their respective Supabase projects
```

---

## Testing Checklist

After deployment, run these tests:

```bash
# 1. DNS Resolution
nslookup primeos.primeodontologia.com.br
nslookup omnios.primeodontologia.com.br

# 2. HTTPS Connection
curl -I https://primeos.primeodontologia.com.br
curl -I https://omnios.primeodontologia.com.br
# Should show: SSL certificate present, 200 OK

# 3. Security Headers
curl -I https://primeos.primeodontologia.com.br | grep -E "Strict-Transport|X-Frame|X-Content"

# 4. Health Checks
curl https://primeos.primeodontologia.com.br/health
curl https://omnios.primeodontologia.com.br/health

# 5. API Status
curl https://primeos.primeodontologia.com.br/api/status
curl https://omnios.primeodontologia.com.br/api/status

# 6. Tenant Detection
curl -H "Authorization: Bearer $TOKEN" \
  https://primeos.primeodontologia.com.br/api/tenant-info

curl -H "Authorization: Bearer $TOKEN" \
  https://omnios.primeodontologia.com.br/api/tenant-info

# 7. Protected Routes (should require auth)
curl https://primeos.primeodontologia.com.br/api/entities/customers
# Expected: 401 Unauthorized

# 8. Rate Limiting (send 101 requests rapidly)
for i in {1..105}; do curl -s https://primeos.primeodontologia.com.br/health; done | grep -c "status"

# 9. Docker Services
ssh root@82.29.56.236 docker compose ps

# 10. Logs
ssh root@82.29.56.236 docker compose logs primeos-api | grep "Tenant:"
```

---

## Troubleshooting

### Issue: DNS not resolving
```bash
# Check DNS record
nslookup omnios.primeodontologia.com.br
# If no result, add A record at Hostinger:
# Domain: omnios.primeodontologia.com.br
# Type: A
# Value: 82.29.56.236
# TTL: 3600

# Wait 24 hours for propagation
```

### Issue: SSL certificate error
```bash
# Check certificate
sudo certbot certificates

# If missing, request new one
sudo certbot certonly --webroot -w /usr/share/nginx/html \
  -d omnios.primeodontologia.com.br

# Check Nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### Issue: API not responding
```bash
# Check services
docker compose ps

# Check logs
docker compose logs primeos-api

# Check ports
netstat -tuln | grep -E "5001|5002|8080|8081"

# Rebuild if needed
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Issue: 502 Bad Gateway
```bash
# Check backend is running
curl http://localhost:5001/health
curl http://localhost:5002/health

# Check Nginx config
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: CORS errors
```bash
# Verify origin header
curl -H "Origin: https://omnios.primeodontologia.com.br" \
  -v https://omnios.primeodontologia.com.br/api/status

# Should show Access-Control headers
# If not, check docker-compose CORS config
```

---

## Monitoring

### Monitor Services

```bash
# SSH into VPS
ssh root@82.29.56.236

# Real-time logs
docker compose logs -f primeos-api

# Service health
watch docker compose ps

# Resource usage
docker stats
```

### Monitor Nginx

```bash
# Real-time access log
sudo tail -f /var/log/nginx/access.log | grep "primeos\|omnios"

# Error log
sudo tail -f /var/log/nginx/error.log

# Check SSL certificates
sudo certbot certificates
```

---

## Rollback Procedure

If something goes wrong:

```bash
# 1. Restore previous Nginx config
sudo cp /etc/nginx/sites-available/primeos.backup /etc/nginx/sites-available/primeos
sudo systemctl reload nginx

# 2. Restart only PrimeOS
docker compose down
docker compose up -d primeos primeos-api

# 3. Revert git changes
git revert HEAD
git pull

# 4. Rebuild
docker compose build
docker compose up -d
```

---

## Performance Tuning

After deployment:

```bash
# Monitor response times
curl -w "Time: %{time_total}s\n" https://primeos.primeodontologia.com.br/api/status

# Expected: < 500ms

# Monitor connections
docker compose stats

# Monitor disk space
df -h
```

---

## Next Steps

1. ✅ Code ready (multi-tenant API, Nginx config)
2. ⏳ Add DNS A record for omnios.primeodontologia.com.br
3. ⏳ Deploy to VPS (run steps above)
4. ⏳ Test both domains
5. ⏳ Monitor performance
6. ⏳ Set up auto-renewal for SSL

---

## Support

**If issues occur:**
1. Check logs: `docker compose logs primeos-api`
2. Review troubleshooting section above
3. Verify DNS is resolving
4. Test health endpoints
5. Check Nginx status: `sudo systemctl status nginx`

