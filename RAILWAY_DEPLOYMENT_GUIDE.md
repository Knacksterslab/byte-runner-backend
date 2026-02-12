# Railway Deployment Guide - Backend Only

Frontend is already deployed to Vercel. This guide covers deploying the NestJS backend to Railway.

---

## Prerequisites

✅ Railway account (https://railway.app)  
✅ GitHub repository pushed (already done!)  
✅ Vercel frontend URL  
✅ Supabase credentials  
✅ SuperTokens credentials

---

## Step 1: Create Railway Project

1. **Go to Railway Dashboard**
   - Visit https://railway.app/dashboard
   - Click **"New Project"**

2. **Deploy from GitHub**
   - Click **"Deploy from GitHub repo"**
   - Authorize Railway to access GitHub if needed
   - Select **`Knacksterslab/byte-runner-backend`**

3. **Railway Auto-Detection**
   - Railway will detect it's a Node.js project
   - Will automatically start deployment

---

## Step 2: Configure Service Settings

1. **Go to Settings Tab** in your Railway project

2. **Set Root Directory**
   - Click **"Service"** → **"Settings"**
   - Find **"Root Directory"**
   - Set to: `byte-runner-backend`
   - Click **"Save"**

3. **Verify Build/Start Commands** (Railway auto-detects these, but confirm):
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`

4. **Set Node Version** (optional but recommended):
   - In Settings, find **"Environment"**
   - Can specify Node version if needed (default is usually fine)

---

## Step 3: Configure Environment Variables

Click on **"Variables"** tab and add these:

### Required Variables

```bash
# App Configuration
NODE_ENV=production
PORT=4000

# Supabase (copy from your byte-runner-backend/.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# SuperTokens (copy from your .env)
SUPERTOKENS_CONNECTION_URI=https://your-supertokens-instance.com
SUPERTOKENS_API_KEY=your_supertokens_api_key

# Frontend URL (your Vercel deployment)
WEBSITE_DOMAIN=https://your-app.vercel.app

# Admin Emails
ADMIN_EMAILS=connect@knacksters.co,connect@byterunner.co
```

### Important Notes:
- **Replace all placeholder values** with your actual credentials
- **Get your Vercel URL** from Vercel dashboard
- **API_DOMAIN** will be added after first deployment (Step 5)

---

## Step 4: Deploy Backend

1. Railway will **automatically deploy** after you add environment variables
2. Watch the **Logs** tab to monitor deployment progress
3. Look for: `✓ Nest application successfully started`

**Common log messages:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] INFO [RoutesResolver] Mapped {/users/me, GET} route
[Nest] INFO [NestApplication] Nest application successfully started
```

---

## Step 5: Get Railway URL and Update Environment

1. **Find Your Railway URL**
   - Go to **"Settings"** → **"Domains"**
   - Copy the generated URL (e.g., `byte-runner-backend-production.up.railway.app`)

2. **Add API_DOMAIN Variable**
   - Go back to **"Variables"** tab
   - Add new variable:
     ```bash
     API_DOMAIN=https://your-backend.railway.app
     ```
   - Railway will auto-redeploy

3. **Update Vercel Frontend Environment**
   - Go to your Vercel project → Settings → Environment Variables
   - Update `NEXT_PUBLIC_API_DOMAIN`:
     ```bash
     NEXT_PUBLIC_API_DOMAIN=https://your-backend.railway.app
     ```
   - Redeploy frontend on Vercel

---

## Step 6: Verify Deployment

### Test Backend Health

```bash
# Health check
curl https://your-backend.railway.app/

# Test users endpoint
curl https://your-backend.railway.app/users/me

# Test contests endpoint
curl https://your-backend.railway.app/contests
```

### Test from Frontend

1. Visit your Vercel frontend
2. Try these actions:
   - ✅ Sign up / Sign in
   - ✅ Play game and save score
   - ✅ View leaderboard
   - ✅ View contests
   - ✅ Admin panel access (if admin)

---

## Step 7: Enable Custom Domain (Optional - Pro Plan Required)

If you want `api.byterunner.co` instead of Railway subdomain:

1. **Go to Settings → Domains**
2. **Click "Add Custom Domain"**
3. **Enter**: `api.byterunner.co`
4. **Add DNS Records** as shown by Railway:
   ```
   Type: CNAME
   Name: api
   Value: your-backend.railway.app
   ```
5. **Wait for DNS propagation** (5-30 minutes)

Then update `API_DOMAIN` and Vercel's `NEXT_PUBLIC_API_DOMAIN` to use custom domain.

---

## Monitoring & Logs

### View Logs
- **Deployments Tab**: See build logs
- **Observability Tab**: Runtime logs
- Filter logs by level: Info, Warn, Error

### Monitor Resources
- **Metrics Tab**: CPU, Memory, Network usage
- Railway shows usage against your plan limits

### Set Up Alerts (Pro Plan)
- Configure alerts for high resource usage
- Get notified of deployment failures

---

## Troubleshooting

### Issue 1: Build Fails with "Module not found"

**Solution:**
```bash
# Ensure package-lock.json is committed
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### Issue 2: CORS Errors from Frontend

**Checklist:**
- ✅ `WEBSITE_DOMAIN` in Railway matches your Vercel URL exactly
- ✅ No trailing slash in URLs
- ✅ Backend redeployed after adding `WEBSITE_DOMAIN`
- ✅ Check `src/main.ts` CORS configuration includes Vercel URL

**Verify CORS in Railway logs:**
```
Looking for: "Access-Control-Allow-Origin" header in responses
```

### Issue 3: Environment Variables Not Working

**Solution:**
- Click **"Redeploy"** after adding variables
- Check variable names are exact (case-sensitive)
- No quotes needed around values in Railway UI

### Issue 4: Port Binding Error

**Solution:**
Railway sets `PORT` automatically. Your `main.ts` should use:
```typescript
const port = process.env.PORT || 4000;
await app.listen(port);
```

### Issue 5: Cron Jobs Not Running

**Check:**
- ✅ `@nestjs/schedule` is in dependencies (not devDependencies)
- ✅ `ScheduleModule.forRoot()` in `app.module.ts`
- ✅ Look for cron logs: `[ContestsCron] Running contest status check...`

### Issue 6: Database Connection Fails

**Check:**
- ✅ `SUPABASE_URL` and `SUPABASE_KEY` are correct
- ✅ Supabase project is not paused (free tier pauses after inactivity)
- ✅ Check Supabase dashboard for connection issues

---

## Cost Management

### Hobby Plan ($5 free credits/month)
**Typical backend usage:**
- ~$3-8/month for light traffic
- 512 MB RAM
- Depends on: requests/minute, database queries, CPU usage

### Tips to Stay Within Budget:
1. **Monitor usage** in Metrics tab
2. **Optimize database queries** (add indexes)
3. **Use caching** where possible
4. **Scale to Pro** only when needed (~$10-20/month)

### When to Upgrade to Pro:
- Consistently using >$5/month
- Need custom domains
- Want priority support
- Require more resources

---

## CI/CD - Automatic Deployments

Railway automatically deploys when you push to GitHub:

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```

2. **Railway detects push** and auto-deploys

3. **Monitor in Deployments tab**

### Disable Auto-Deploy (if needed):
- Settings → Service → Deployments
- Toggle "Auto Deploy" off
- Deploy manually from dashboard

---

## Rollback to Previous Version

If a deployment breaks something:

1. **Go to Deployments tab**
2. **Find working deployment**
3. **Click "⋯" menu** → **"Redeploy"**
4. Previous version goes live

---

## Environment-Specific Deployments (Advanced)

If you want staging + production:

1. **Create two Railway services**:
   - `byte-runner-backend-staging` (deploy from `develop` branch)
   - `byte-runner-backend-production` (deploy from `main` branch)

2. **Different environment variables** for each

3. **Two Vercel projects** pointing to respective backends

---

## Next Steps After Deployment

1. ✅ **Test thoroughly** - All features work end-to-end
2. ✅ **Set up monitoring** - Check logs daily initially
3. ✅ **Document your URLs** - Save Railway & Vercel URLs
4. ✅ **Set up backups** - Supabase handles this automatically
5. ✅ **Plan scaling** - Monitor usage for first month
6. ✅ **Email setup** - Implement prize claim notifications (see EMAIL_SETUP_TODO.md)

---

## Quick Reference

### Your URLs After Deployment
- **Frontend (Vercel)**: `https://your-app.vercel.app`
- **Backend (Railway)**: `https://your-backend.railway.app`
- **Database**: Supabase (already configured)
- **Auth**: SuperTokens (already configured)

### Important Files
- `railway.json` - Railway configuration
- `.env.example` - Template for environment variables
- `package.json` - Build and start scripts

### Support Resources
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your documentation: `EMAIL_SETUP_TODO.md`, `PRIZE_CLAIM_IMPLEMENTATION.md`

---

## Success Checklist

Before going live:

- [ ] Backend deploys successfully on Railway
- [ ] All environment variables set correctly
- [ ] Frontend can reach backend (CORS working)
- [ ] Authentication works (sign up/sign in)
- [ ] Leaderboard saves and displays
- [ ] Contests load and display
- [ ] Admin panel accessible
- [ ] Cron jobs running (check logs every 5 minutes)
- [ ] Database queries working
- [ ] No errors in Railway logs

---

**You're ready to deploy! 🚀**

Any issues? Check the troubleshooting section or Railway logs first.
