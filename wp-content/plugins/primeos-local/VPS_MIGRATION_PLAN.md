# 🚀 VPS MIGRATION PLAN - Hostinger → Future Provider

**Current Setup (Hostinger VPS):**
- VPS IP: 82.29.56.236
- OS: Ubuntu 24.04 LTS
- Services: Docker (3 containers)
- Domains: 
  - primeos.primeodontologia.com.br
  - omnios.omnios.com.br
- Databases: 2 Supabase projects (separate)
- Storage: ~15.4GB used / 47.39GB total

---

## Decision Matrix: What's Best for You?

| Option | Cost | Complexity | Scalability | Best For |
|--------|------|-----------|-------------|----------|
| **1. Cheaper VPS** | $40-60/yr | Low | Medium | Budget-conscious, same setup |
| **2. Better VPS** | $100-200/yr | Low | High | Growing apps, better performance |
| **3. DigitalOcean/Linode** | $60-120/yr | Medium | High | Developer-friendly, reliable |
| **4. AWS/GCP/Azure** | $20-300/yr | High | Very High | Enterprise, auto-scaling |
| **5. Vercel (Hybrid)** | $0-100/yr | Medium | High | Frontend on Vercel, API on VPS |
| **6. Full Managed (Heroku)** | $100-500/yr | Low | Low | Simple but expensive |

---

## Recommended Path for You

### **OPTION: Hybrid Approach** ⭐ (Best for your situation)

**Frontend:** Vercel (Free tier possible)
- Already testing Vercel
- Better performance globally
- Free CDN + auto-scaling
- GitHub integration

**Backend/API:** Better VPS (~$100/yr)
- Keep Docker setup (no changes)
- Same code, same deployment
- Just change VPS provider

**Databases:** Keep Supabase (unchanged)
- Already working perfectly
- No migration needed
- Scales independently

**Cost:** $0-100/yr (compared to Hostinger)

---

## Alternative Options Explained

### Option 1: Stay with Hostinger (Cheaper VPS)
✅ Pros:
- Same familiar provider
- Minimal changes
- Easy renewal

❌ Cons:
- Still $40-60/year
- Limited performance
- No significant upgrade

**Recommendation:** ⭐ Not ideal if Hostinger is expensive

---

### Option 2: DigitalOcean or Linode
✅ Pros:
- Better performance
- Developer-friendly
- Similar price ($60-120/yr for basic)
- Easy Docker support
- Better uptime SLA

❌ Cons:
- Need to migrate
- Setup from scratch

**Cost:** $5-10/month = $60-120/year

**Recommendation:** ⭐⭐⭐ Good alternative

---

### Option 3: AWS/GCP/Azure
✅ Pros:
- Enterprise-grade
- Auto-scaling
- Pay-as-you-go

❌ Cons:
- Complex to set up
- Cost can spiral ($20-300+/month)
- Overkill for your current load

**Recommendation:** ⭐ Only if you scale significantly

---

### Option 4: Full Vercel + Serverless
✅ Pros:
- Zero server management
- Auto-scaling built-in
- Free tier available

❌ Cons:
- Expensive for API ($20-100/month)
- Cold starts (Vercel Functions)
- Complex migration

**Cost:** $0-500+/month

**Recommendation:** ⭐⭐ For future exploration

---

## My Recommendation: Hybrid (Vercel + DigitalOcean)

### Why?
1. ✅ **Frontend on Vercel** → You're already testing it
2. ✅ **API on DigitalOcean** → Better than Hostinger, $60/yr
3. ✅ **Databases stay Supabase** → No changes needed
4. ✅ **Same Docker setup** → Copy-paste deployment
5. ✅ **Total cost:** ~$60/year (maybe cheaper than Hostinger)

### Timeline:

**December (Before Hostinger expires):**
```
Week 1-2: Set up new VPS (DigitalOcean/Linode)
Week 3: Migrate code + test
Week 4: Update DNS
```

**After migration:**
```
- Keep both running for 1 week (test)
- Switch fully
- Cancel Hostinger
```

---

## Step-by-Step Migration Plan

### Phase 1: Prepare (Week 1)

**Day 1-2: Choose Provider**
- [ ] Compare DigitalOcean, Linode, Vultr
- [ ] Choose $5-10/month basic VPS
- [ ] Create account + new VPS

**Day 3-4: Set up New VPS**
- [ ] Install Ubuntu 24.04
- [ ] Install Docker + Docker Compose
- [ ] Install Nginx + Certbot
- [ ] Configure firewall

**Day 5-7: Test Locally**
- [ ] Clone your repo
- [ ] Test `docker compose up`
- [ ] Verify all services work

### Phase 2: Deploy (Week 2)

**Day 1-2: Copy Code to New VPS**
- [ ] SCP all files to new server
- [ ] Update DNS (test with hosts file)
- [ ] Run deployment script
- [ ] Verify endpoints

**Day 3-7: Monitor + Test**
- [ ] Check logs daily
- [ ] Test both domains
- [ ] Performance benchmarks
- [ ] Security check

### Phase 3: Switch (Week 3-4)

**Day 1-2: Update DNS**
- [ ] Point primeos.primeodontologia.com.br to new IP
- [ ] Point omnios.omnios.com.br to new IP
- [ ] Wait for DNS propagation (24-48h)

**Day 3-7: Monitor**
- [ ] Watch error logs
- [ ] Check uptime
- [ ] Test from multiple locations
- [ ] Keep Hostinger running as backup

**Final: Cleanup**
- [ ] Cancel Hostinger after 30 days
- [ ] Archive old configs

---

## Estimated Costs Comparison

### Current: Hostinger VPS
```
Hostinger VPS:     $40-80/year  (renewal)
Supabase:          $0           (free tier)
Domains:           $0           (you manage)
────────────────────────────────
TOTAL:             $40-80/year
```

### Proposed: Vercel + DigitalOcean
```
DigitalOcean VPS:  $60-120/year ($5-10/month)
Vercel (frontend): $0           (free tier) or $20-100/year
Supabase:          $0           (free tier)
Domains:           $0           (you manage)
────────────────────────────────
TOTAL:             $60-220/year (but better performance)
```

### Savings:
- If Hostinger renewal is $80 → Save $0-20
- But get better performance, reliability, support

---

## What Doesn't Change

✅ **Supabase databases** - No migration needed
- Both projects stay the same
- No data loss risk
- Just update credentials if needed

✅ **Your code** - Fully portable
- Docker makes it location-agnostic
- Same `docker compose` commands
- Just change environment variables (IP, DNS)

✅ **SSL certificates** - Auto-renewed
- Let's Encrypt via Certbot
- Works on any VPS

✅ **Domains** - Just update DNS
- No domain registration change
- Just point to new IP

---

## Migration Checklist

**Before Migration:**
- [ ] Backup all code to GitHub (already done ✅)
- [ ] Export Supabase data (optional, RLS handles it)
- [ ] Document current setup
- [ ] Create new VPS
- [ ] Test new VPS locally

**During Migration:**
- [ ] Copy files to new VPS
- [ ] Verify services run
- [ ] Test endpoints
- [ ] Monitor logs

**After Migration:**
- [ ] Update DNS
- [ ] Monitor for 24-48 hours
- [ ] Verify both domains work
- [ ] Cancel old VPS

---

## Questions for You

To finalize the plan, answer these:

1. **Budget preference?**
   - [ ] Keep same ($40-80/yr)
   - [ ] Spend a bit more for better service ($100-200/yr)
   - [ ] Go enterprise ($300+/yr)

2. **Priority?**
   - [ ] Cost savings
   - [ ] Better performance
   - [ ] Better support
   - [ ] All equal

3. **Timeline?**
   - [ ] Now (December)
   - [ ] Q1 2027 (January-March)
   - [ ] Flexible

4. **Vercel for frontend?**
   - [ ] Yes, migrate PrimeOS to Vercel
   - [ ] No, keep both on VPS
   - [ ] Maybe later

---

## Recommended Next Steps

1. **This month:** Start planning
2. **December:** Set up new VPS
3. **Early 2027:** Migrate
4. **Mid 2027:** Fully switched

**Timeline:** 2-4 weeks total work

---

## My Top Pick: **DigitalOcean + Vercel**

**Why:**
- ✅ Better than Hostinger ($60/yr vs likely $80+)
- ✅ Same Docker setup (no learning curve)
- ✅ Excellent documentation
- ✅ Community support
- ✅ Scalable when you grow
- ✅ Vercel gives global CDN for free

**Cost:** $60-80/year (cheaper or same as Hostinger)
**Effort:** 2-3 weeks
**Benefit:** Better performance, reliability, support

---

## Ready to Proceed?

Answer the 4 questions above, and I'll create:
1. Detailed step-by-step migration guide
2. New VPS setup scripts
3. Deployment automation
4. Testing checklist

**What would you prefer?** 👍
