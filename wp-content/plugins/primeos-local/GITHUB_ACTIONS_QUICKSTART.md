# 🚀 GitHub Actions Setup - Quick Start (5 minutes)

## Step 1: Generate SSH Key (Local Machine)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy-key -N ""
cat ~/.ssh/github-deploy-key
```

Copy the output (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`)

---

## Step 2: Add Public Key to VPS

```bash
ssh root@82.29.56.236
# Password: Dentista2027..

# Add GitHub's public key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

(Replace with your actual public key from `~/.ssh/github-deploy-key.pub`)

---

## Step 3: Add Secrets to GitHub

1. Go to: https://github.com/AndrePrimeLabs/primeos-local
2. Click: **Settings → Secrets and variables → Actions**
3. Click: **New repository secret**

Add these secrets:

### Secret 1: VPS_HOST
```
Name: VPS_HOST
Value: 82.29.56.236
```

### Secret 2: VPS_USER
```
Name: VPS_USER
Value: root
```

### Secret 3: VPS_SSH_KEY
```
Name: VPS_SSH_KEY
Value: [paste entire contents of ~/.ssh/github-deploy-key - including BEGIN/END lines]
```

### Secret 4: SUPABASE_URL (optional, for documentation)
```
Name: SUPABASE_URL
Value: https://foeahubnrbclbelsqikp.supabase.co
```

---

## Step 4: Test the Workflow

1. Go to: **Actions** tab in your GitHub repo
2. Click: **Deploy to VPS** workflow
3. Click: **Run workflow** → **Run workflow** button
4. Watch it deploy in real-time! 🎉

---

## Step 5: Automatic Deploy on Every Push

Now whenever you:
```bash
git add .
git commit -m "Update something"
git push origin main
```

GitHub Actions will automatically:
- ✅ Pull latest code
- ✅ Rebuild Docker images
- ✅ Restart all services
- ✅ Test endpoints

**Check deployment:** Go to **Actions** tab, watch the workflow run

---

## How to Use

### **Manual Deployment (anytime)**
1. Go to **Actions** tab
2. Click **Deploy to VPS**
3. Click **Run workflow**
4. Done! ✅

### **Automatic Deployment (on every push)**
Just push to main:
```bash
git push origin main
# Automatically deploys!
```

---

## Verify It's Working

After first successful deployment:

```bash
# Check workflow ran
https://github.com/AndrePrimeLabs/primeos-local/actions

# Check VPS services
ssh root@82.29.56.236
docker compose ps
curl http://localhost:8080/health
```

---

## Troubleshooting

### ❌ Workflow fails: "Permission denied"

**Fix:** SSH key wasn't added correctly to VPS
```bash
ssh root@82.29.56.236
# Verify key is in authorized_keys
cat ~/.ssh/authorized_keys | grep "AAAAC3"
```

### ❌ Workflow fails: "Connection timeout"

**Fix:** Firewall blocking port 22
```bash
# Check SSH access works
ssh -i ~/.ssh/github-deploy-key root@82.29.56.236 "echo OK"
```

### ❌ Services don't start after deploy

**Fix:** Check logs on VPS
```bash
ssh root@82.29.56.236
docker compose logs primeos-api | tail -50
```

---

## Benefits for Your Migration

When you move from Hostinger to DigitalOcean:

1. **Update one secret:** Change `VPS_HOST` to new IP
2. **Everything else works:** Same workflow, same code
3. **Easy rollback:** Change `VPS_HOST` back to old IP
4. **Zero downtime:** Deploy to both simultaneously

---

## What's Happening

```
You push code → GitHub → Workflow runs → SSH connects to VPS → 
Pulls code → Rebuilds Docker → Restarts services → Tests endpoints
```

All automated, all in GitHub! 🚀

---

## Next: Advanced Options

- [ ] Add approval step (requires approval before deploy)
- [ ] Deploy to multiple VPS (staging + production)
- [ ] Rollback previous version
- [ ] Slack notifications on deploy

---

**That's it! You now have automated CI/CD deployment.** 🎉

Push code → Auto-deploy. Simple and powerful!
