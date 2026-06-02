# Deployment Guide - Nora Agents

## Deployment Options

This guide covers deploying to **Railway**, which is the recommended platform.

## Railway Deployment

### Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **Git Repository**: Code must be in a Git repository
3. **GitHub Connection**: Link your GitHub account to Railway

### Initial Setup (One Time)

#### 1. Push Code to GitHub

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

#### 2. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select the `Agents` repository
6. Railway will auto-detect `railway.json`

#### 3. Configure Environment Variables

In Railway Dashboard:

1. Click "Variables" tab
2. Add variables:

```
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
FRONTEND_URL=https://ctm-analyzer-backend-production.up.railway.app
POSTGRES_URL=postgresql://...  (if using Railway PostgreSQL)
MONGODB_URI=...                (if using MongoDB Atlas)
```

**Important**: Do NOT add leading/trailing spaces!

#### 4. Configure Database (Optional)

**Option A: Use Railway PostgreSQL**
1. In Railway Dashboard, go to "Plugins"
2. Add "PostgreSQL"
3. Railway automatically sets `DATABASE_URL`
4. Update backend `.env`: use `POSTGRES_URL=$DATABASE_URL`

**Option B: Use MongoDB Atlas**
1. Create cluster at https://cloud.mongodb.com
2. Get connection string
3. Add as `MONGODB_URI` in Railway Variables

**Option C: Use Fallback Storage**
- Leave both database variables empty
- Backend will use JSON file storage

### Deploy Process

#### Automatic Deployment (Recommended)

1. Make changes locally
2. Commit and push to GitHub
3. Railway automatically detects push
4. Triggers build from `railway.json`:
   - `buildCommand`: `npm run build:all`
   - `startCommand`: `npm run start`
5. Deploys automatically (2-5 minutes)

#### Manual Redeploy

1. Go to Railway Dashboard
2. Click "Services" → your service
3. Click "Deploy" button
4. Wait for build and deployment (2-5 minutes)

#### Redeploy Latest Code

```bash
# Make changes
git add .
git commit -m "Update code"
git push origin main

# Railway automatically deploys
# Or manually trigger from dashboard
```

### Monitor Deployment

1. Go to Railway Dashboard
2. Click "Deployments" tab
3. View real-time build logs:
   - Green = Success
   - Red = Failed
   - Yellow = In progress

**Build phases**:
```
1. Download code from GitHub
2. npm run build:all
   - npm install (backend)
   - npm install (frontend)
   - npm run build (frontend → dist/)
3. npm run start
   - Start backend on port 3001
   - Serve frontend from dist/
4. Health check: GET /health
```

### Verify Deployment

#### Test Health Endpoint

```bash
curl https://ctm-analyzer-backend-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Nora API Backend is running"
}
```

#### Test Dashboard

Open in browser:
```
https://ctm-analyzer-backend-production.up.railway.app
```

Should load the React dashboard.

#### Test API Endpoints

```bash
# Get metrics
curl https://ctm-analyzer-backend-production.up.railway.app/api/metrics

# Get conversations
curl https://ctm-analyzer-backend-production.up.railway.app/api/conversations
```

### Logs and Debugging

#### View Logs

In Railway Dashboard:
1. Click "Services" → your service
2. Click "Logs" tab
3. View live logs

#### Common Log Messages

**Success**:
```
✅ MongoDB conectado exitosamente
✅ PostgreSQL connected
🚀 Server running on port 3001
```

**Errors to watch for**:
```
Error: ENOENT: no such file or directory 'frontend/dist'
  → Frontend didn't compile, check build logs

EADDRINUSE: address already in use
  → Port conflict (should not happen on Railway)

Cannot find module
  → Missing import, check file paths
```

### Update Configuration

#### Add/Update Environment Variable

1. Go to Railway Dashboard
2. Click "Variables"
3. Add or update variable
4. Railway auto-redeploys (1-2 minutes)

#### Change Database

1. Update database URL in Variables
2. Update `.env` to reference new DB
3. Commit and push
4. Railway redeploys automatically

### Database Management

#### PostgreSQL via Railway

```bash
# Connection from local terminal
psql postgresql://...@railway.app:...

# List tables
\dt

# View conversations
SELECT * FROM conversations;
```

#### MongoDB Atlas via Web

1. Go to https://cloud.mongodb.com
2. Click "Databases"
3. View, query, modify data

### Custom Domain

#### Add Domain

1. Go to Railway Project Settings
2. Click "Domains"
3. Add custom domain
4. Update DNS records (follow Railway instructions)

Example:
- **Railway URL**: `ctm-analyzer-backend-production.up.railway.app`
- **Custom Domain**: `nora-api.yourdomain.com`

### Team Collaboration

#### Add Team Members

1. Go to Railway Project
2. Click "Project Settings" → "Members"
3. Invite team members by email
4. They can view logs, redeploy, etc.

### Rollback

#### Revert to Previous Deployment

1. Go to "Deployments" tab
2. Find previous successful deployment
3. Click "Rollback"
4. Confirms revert (1-2 minutes)

**Note**: Only last 10 deployments are kept

### Common Issues & Fixes

#### Build Fails: Cannot find module

**Cause**: Missing dependencies or wrong file path

**Fix**:
1. Test locally: `npm run build:all`
2. Check imports are correct
3. Verify files exist
4. Push fix to GitHub
5. Railway redeploys

#### Build Fails: ENOENT frontend/dist

**Cause**: Frontend build didn't run

**Fix**:
1. Verify `vite build` runs locally
2. Check `frontend/package.json` has build script
3. Verify `railway.json` has correct buildCommand
4. Push and redeploy

#### API Returns 502 Bad Gateway

**Cause**: Backend crashed or not responding

**Fix**:
1. Check backend logs
2. Verify environment variables are set
3. Check database connection
4. Try manual redeploy

#### Health Check Fails

**Cause**: Backend not starting or listening wrong port

**Fix**:
1. Check logs for errors
2. Verify PORT environment variable
3. Check health check endpoint: `GET /health`
4. Ensure Railway can access port

### Monitoring & Alerts

#### View Resource Usage

In Railway Dashboard:
1. Click "Analytics" tab
2. View CPU, Memory, Network usage
3. Set up alerts (optional)

#### Health Monitoring

Railway monitors:
- Build success/failure
- Deployment status
- HTTP endpoints (via health check)
- Logs for errors

### Backup & Data

#### Backup PostgreSQL

```bash
# From local terminal
pg_dump postgresql://...@railway.app > backup.sql

# Restore
psql postgresql://...@railway.app < backup.sql
```

#### Backup MongoDB

```bash
# Via MongoDB Atlas
1. Go to cloud.mongodb.com
2. Click "Backup"
3. Create on-demand backup
4. Download backup file
```

#### Backup Fallback Storage

```bash
# Git tracks fallback-conversations.json
git log --oneline backend/src/data/

# Revert if needed
git checkout <commit> -- backend/src/data/fallback-conversations.json
```

### Cost Optimization

**Railway Pricing** (as of June 2024):
- $5/month base + usage
- Typically $0-15 for small projects
- PostgreSQL add-on: ~$5/month

**Tips to reduce costs**:
- Use fallback storage instead of databases
- Minimize external API calls
- Monitor and delete old logs
- Use Railway PostgreSQL vs. external DB

### Security Best Practices

- ✅ Store secrets in Railway Variables (not git)
- ✅ Use strong API keys
- ✅ Enable HTTPS (automatic with Railway)
- ✅ Limit CORS to known origins
- ✅ Keep dependencies updated
- ❌ Never commit `.env` files
- ❌ Never expose secrets in logs

### Performance Tuning

#### Frontend Optimization

- Minified CSS/JS via Vite build
- Tree-shaking removes unused code
- Lazy loading of components
- Result: ~50KB bundle size

#### Backend Optimization

- Connection pooling for databases
- Caching with Redis (optional)
- Gzip compression
- Request logging
- Monitor with Railway Analytics

### Continuous Integration/Deployment

Current setup uses **GitHub push → Railway auto-deploy**.

For more control, add CI/CD pipeline:
1. GitHub Actions: Run tests on push
2. Only merge to main if tests pass
3. Railway auto-deploys from main

### Post-Deployment Checklist

After deploying:

- [ ] Health check returns 200
- [ ] Dashboard loads at root URL
- [ ] API endpoints respond
- [ ] Metrics are calculated
- [ ] Conversations can be captured
- [ ] Database is persisting data
- [ ] Logs show no errors
- [ ] Environment variables are set
- [ ] Custom domain working (if applicable)
- [ ] Team members can access

### Disaster Recovery

#### If Production Goes Down

1. **Immediate**:
   - Check Railway Status page
   - View logs for error
   - Check database status

2. **Short term**:
   - Rollback to previous deployment
   - Fix issue locally
   - Push hotfix
   - Railway redeploys (2-5 min)

3. **Long term**:
   - Add monitoring/alerts
   - Improve error handling
   - Add tests
   - Document lessons learned

---

## Alternative Deployment Platforms

If you want to use other platforms:

### Heroku
- Similar to Railway
- Requires Procfile
- Free tier removed (cost-based now)

### Vercel
- Good for frontend only
- Backend needs separate service

### AWS/Google Cloud
- More complex setup
- Better for enterprise
- Overkill for this project

### DigitalOcean
- Simple VPS
- Requires manual setup
- Manual scaling needed

**Recommendation**: Stick with Railway for simplicity.

---

**Last Updated**: June 2024
**Version**: 1.0.0
**Next Review**: When deploying major changes
