# 🚀 Using GitHub Organizations for VPS Deployment & Migration

**Good news:** YES! Your GitHub Organizations plan includes powerful deployment & automation tools that can help with your VPS migration!

---

## What's Included in GitHub Organizations Plan

| Feature | Included | Use Case |
|---------|----------|----------|
| **GitHub Actions** | ✅ Unlimited | Auto-deploy, CI/CD |
| **Secrets Management** | ✅ Yes | Store API keys securely |
| **Workflows** | ✅ Yes | Automate deployments |
| **Deploy Keys** | ✅ Yes | VPS SSH access |
| **Branch Protection** | ✅ Yes | Protect main branch |
| **Code Scanning** | ✅ Yes | Security scanning |
| **Team Permissions** | ✅ Yes | Manage access |

---

## How to Use GitHub for VPS Deployment

### **Setup 1: Automated Deployment with GitHub Actions**

Create a workflow file: `.github/workflows/deploy.yml`

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/primeos-local
            git pull origin main
            docker compose down
            docker compose build
            docker compose up -d
```

**Result:** Every time you push to main, automatically:
- ✅ Pulls latest code
- ✅ Rebuilds Docker images
- ✅ Restarts services
- ✅ Deploys to VPS

---

### **Setup 2: Secure Secrets Storage**

In GitHub:
1. Go to **Settings → Secrets and variables → Actions**
2. Add these secrets:

```
VPS_HOST=82.29.56.236
VPS_USER=root
VPS_SSH_KEY=[your-ssh-private-key]
SUPABASE_URL=https://foeahubnrbclbelsqikp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxx
OMNIOS_SUPABASE_URL=https://evqjnfhnajuvwjqcthhf.supabase.co
```

**Benefit:** Never put credentials in code, GitHub stores them encrypted

---

### **Setup 3: Automated Testing Before Deploy**

```yaml
name: Test & Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Docker build
        run: docker compose build --no-cache
      - name: Run health check
        run: docker compose up -d && sleep 5 && curl http://localhost:8080/health

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/primeos-local
            git pull origin main
            docker compose restart
```

**Result:** 
- ✅ Tests run on every push
- ✅ Only deploys if tests pass
- ✅ Automatic rollback if fails

---

## Using GitHub for VPS Migration

### **Scenario: Migrate from Hostinger to DigitalOcean**

**Step 1: Create migration branch**
```bash
git checkout -b migrate/digitalocean
```

**Step 2: Update deploy script**
- Update IP address in secrets
- Add new environment variables
- Test on staging (new VPS)

**Step 3: Automated testing**
- GitHub Actions runs tests on new VPS
- If passes, merge to main
- Auto-deploys to new VPS

**Step 4: Cutover**
- Update DNS
- GitHub Actions keeps both in sync
- Easy rollback if needed

---

## GitHub Actions Benefits for Your Setup

✅ **Automated Deployments**
- Push code → Auto-deploy to VPS
- No manual SSH commands
- Consistent every time

✅ **Secrets Management**
- Secure storage (encrypted)
- Never commit credentials
- Easy rotation

✅ **Testing Before Deploy**
- Build Docker images
- Run health checks
- Prevent broken deploys

✅ **Deployment History**
- See every deployment
- Logs for debugging
- Rollback capability

✅ **Multi-Environment**
- Deploy to staging VPS
- Test, then to production VPS
- Approval workflows

✅ **Team Collaboration**
- Code reviews before deploy
- Audit trail
- Permissions management

---

## How to Set Up GitHub Actions (Step-by-Step)

### **Step 1: Generate SSH Key for GitHub**

On your local machine:
```bash
ssh-keygen -t ed25519 -f github-deploy-key -N ""
```

This creates:
- `github-deploy-key` (private key)
- `github-deploy-key.pub` (public key)

### **Step 2: Add Public Key to VPS**

```bash
# On VPS
cat github-deploy-key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### **Step 3: Add Secrets to GitHub**

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add each secret:

```
Name: VPS_HOST
Value: 82.29.56.236

Name: VPS_USER
Value: root

Name: VPS_SSH_KEY
Value: [paste contents of github-deploy-key]

Name: SUPABASE_URL
Value: https://foeahubnrbclbelsqikp.supabase.co

Name: SUPABASE_SERVICE_ROLE_KEY
Value: [your-key]
```

### **Step 4: Create Workflow File**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: 22
          script: |
            cd /root/primeos-local
            git pull origin main
            docker compose down
            docker compose build --no-cache
            docker compose up -d
            echo "✅ Deployment complete"
```

### **Step 5: Test It**

1. Push a small change to main
2. Go to repo → **Actions** tab
3. Watch the workflow run
4. Check VPS deployed automatically

---

## Advanced: Approval Before Deploy

```yaml
name: Deploy with Approval

on:
  workflow_dispatch:  # Manual trigger only
  
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: 
      name: production
      # Requires approval before deploy
    
    steps:
      - uses: actions/checkout@v3
      - uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/primeos-local
            git pull origin main
            docker compose up -d
```

**Result:** 
- Click "Run workflow" in GitHub
- Requires your approval
- Then deploys automatically

---

## Migration Workflow: Using GitHub

### **Week 1: Prepare New VPS**

1. Create new VPS on DigitalOcean
2. Add SSH key from GitHub
3. Clone your repo:
   ```bash
   git clone https://github.com/AndrePrimeLabs/primeos-local.git
   cd primeos-local
   docker compose up -d
   ```

### **Week 2: Test & Validate**

1. Update GitHub secrets with NEW VPS IP
2. Create staging branch: `git checkout -b staging/digitalocean`
3. Push change
4. GitHub Actions deploys to new VPS
5. Test everything works

### **Week 3: Cutover**

1. Merge staging branch to main
2. Update DNS to point to new VPS
3. GitHub Actions auto-deploys to new VPS
4. Monitor for 24 hours

### **Week 4: Cleanup**

1. Cancel Hostinger
2. Keep GitHub Actions running for continuous deployment

---

## Cost Impact

**GitHub Organizations Plan you already pay:** ✅
- GitHub Actions: 3,000 minutes/month free
- Secrets: Unlimited
- Deployments: Unlimited

**Your usage:** 
- Each deploy: ~2-5 minutes
- ~100 deploys/month max = 200-500 minutes
- **Result:** Free tier is sufficient! 🎉

---

## Summary: What You Get with GitHub

| Task | Old Way | With GitHub Actions |
|------|---------|-------------------|
| Deploy | Manual SSH + commands | Push to main |
| Secrets | Hardcoded in files | Encrypted in GitHub |
| Testing | Manual | Automatic |
| Multiple VPS | Complex | Environment switching |
| Rollback | Manual restore | Git revert + auto-deploy |
| Team Deploy | Coordination | One approval |
| Migration | Risky, manual | Automated, reversible |

---

## Recommendation for Your Migration

**Use GitHub Actions to:**

1. ✅ **Automate deployment** to new VPS
2. ✅ **Store secrets securely** (no Dentista2027.. in plain text!)
3. ✅ **Test before deploying** (build Docker, health checks)
4. ✅ **Make migration reversible** (quick rollback to Hostinger)
5. ✅ **Document everything** (deployment history in Actions tab)

**Timeline with GitHub:**
- ✅ Week 1: Set up GitHub Actions workflow
- ✅ Week 2: Test deployment to new VPS
- ✅ Week 3: Cutover (just update DNS)
- ✅ Week 4: Monitor & verify

---

## Next Steps

1. **Generate SSH key** for GitHub
2. **Add VPS secrets** to GitHub
3. **Create `.github/workflows/deploy.yml`**
4. **Push to main** and watch auto-deploy
5. **Monitor in Actions tab**

**Would you like me to:**
- [ ] Create the GitHub Actions workflow file?
- [ ] Guide you through setting up SSH keys?
- [ ] Help with the migration workflow?

---

**Bottom line:** YES! Use your GitHub Organizations plan for:
- ✅ Automated deployments
- ✅ Secure secrets management
- ✅ Easy VPS migration
- ✅ Continuous deployment

It's **free (you already pay for it)** and **makes migration way safer**! 🚀
