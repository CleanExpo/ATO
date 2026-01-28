# Production Deployment Guide

Complete guide for deploying the ATO application to Vercel with monitoring and error tracking.

---

## Prerequisites

- ✅ Vercel account created
- ✅ GitHub repository connected to Vercel
- ✅ Supabase project created
- ✅ Xero app credentials
- ✅ Google Gemini API key
- ✅ Sentry account (optional but recommended)

---

## 1. Environment Variables Configuration

### Required Variables

Add these to your Vercel project settings (Settings → Environment Variables):

#### **Supabase Configuration**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### **NextAuth Configuration**
```bash
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

#### **Xero OAuth Configuration**
```bash
XERO_CLIENT_ID=your-xero-client-id
XERO_CLIENT_SECRET=your-xero-client-secret
XERO_REDIRECT_URI=https://your-domain.vercel.app/api/auth/xero/callback
```

#### **Google Gemini AI**
```bash
GOOGLE_AI_API_KEY=your-gemini-api-key
```

#### **Sentry Error Tracking (Optional)**
```bash
# Public DSN for client-side errors
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Server-side DSN
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Sentry organization and project
SENTRY_ORG=your-org-name
SENTRY_PROJECT=ato-app

# Sentry auth token (for source map uploads)
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

### Optional Variables

```bash
# Tenant ID for testing (optional)
TENANT_ID=8a8caf6c-614b-45a5-9e15-46375122407c

# Node environment (auto-set by Vercel)
NODE_ENV=production
```

---

## 2. Vercel Deployment Configuration

### vercel.json

The project includes a `vercel.json` configuration file with:

- **Build settings**: Optimized for Next.js 16
- **Environment configuration**: Production settings
- **Header configuration**: Security headers
- **Route configuration**: Redirects and rewrites

### Build Command

```bash
npm run build
```

### Install Command

```bash
npm install
```

### Output Directory

```
.next
```

---

## 3. Database Setup

### Run Migrations

Before deploying, ensure all Supabase migrations are applied:

```bash
# Connect to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Required Tables

Verify these tables exist in Supabase:

- ✅ `xero_connections`
- ✅ `xero_transactions_cache`
- ✅ `historical_transactions_cache`
- ✅ `forensic_analysis_results`
- ✅ `ai_analysis_costs`
- ✅ `audit_sync_status`
- ✅ `agent_reports`

---

## 4. Sentry Setup (Error Tracking)

### Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create new project (Next.js)
3. Copy the DSN
4. Generate an auth token for source map uploads

### Configure Sentry

Add Sentry environment variables to Vercel (see section 1).

### Test Sentry Integration

After deployment, trigger a test error:

```bash
curl https://your-domain.vercel.app/api/test-error
```

Check Sentry dashboard for the error report.

---

## 5. Health Checks & Monitoring

### Health Check Endpoint

Monitor application health at:

```
GET https://your-domain.vercel.app/api/health
```

**Quick check** (skips AI model test):
```
GET https://your-domain.vercel.app/api/health?quick=true
```

### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T...",
  "checks": {
    "environment": { "status": "pass" },
    "database": { "status": "pass", "responseTime": 145 },
    "aiModel": { "status": "pass", "modelName": "gemini-2.0-flash-exp" }
  }
}
```

### Uptime Monitoring

Set up external monitoring with:

- **UptimeRobot**: Free monitoring service
- **Better Uptime**: Vercel integration
- **Pingdom**: Enterprise monitoring

Configure monitors to check `/api/health` every 5 minutes.

---

## 6. Performance Monitoring

### Vercel Analytics

Enable in Vercel dashboard:

1. Go to your project
2. Click "Analytics" tab
3. Enable "Vercel Analytics"

### Metrics Tracked

- Core Web Vitals (LCP, FID, CLS)
- Page load times
- API response times
- Error rates

### Vercel Speed Insights

Enable in Vercel dashboard for real user monitoring (RUM).

---

## 7. Rate Limiting

API endpoints are protected with in-memory rate limiting:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 60 seconds |
| AI Analysis | 10 requests | 60 seconds |
| API Endpoints | 100 requests | 60 seconds |
| Health Check | 1000 requests | 60 seconds |

For distributed rate limiting (multiple Vercel instances), consider:

- **Upstash Redis**: Vercel-optimized Redis
- **Vercel KV**: Edge-compatible key-value store

---

## 8. Security Configuration

### Security Headers

Configured in `next.config.ts`:

- ✅ `Strict-Transport-Security`: HTTPS enforcement
- ✅ `X-Frame-Options`: Clickjacking protection
- ✅ `X-Content-Type-Options`: MIME-sniffing protection
- ✅ `X-XSS-Protection`: XSS protection
- ✅ `Referrer-Policy`: Referrer information control

### Environment Variable Security

- ✅ Never commit `.env.local` to Git
- ✅ Use Vercel environment variables
- ✅ Rotate secrets regularly
- ✅ Use different credentials for dev/staging/production

### API Security

- ✅ Rate limiting enabled
- ✅ Input validation with Zod (where implemented)
- ✅ CORS configured for API routes
- ✅ Authentication required for sensitive endpoints

---

## 9. Deployment Process

### Initial Deployment

1. **Connect GitHub Repository to Vercel**
   ```bash
   vercel link
   ```

2. **Configure Environment Variables**
   - Add all required variables in Vercel dashboard
   - Set for "Production" environment

3. **Deploy**
   ```bash
   git push origin main
   ```

   Vercel will automatically deploy on push to `main` branch.

### Deployment Checklist

Before each deployment:

- [ ] All tests passing (`npm run test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Health check endpoint responds correctly
- [ ] Sentry configured (if using)

---

## 10. Post-Deployment Verification

### 1. Check Health Endpoint

```bash
curl https://your-domain.vercel.app/api/health
```

Expected: `200 OK` with `"status": "healthy"`

### 2. Test Authentication

Visit: `https://your-domain.vercel.app/api/auth/xero`

Expected: Redirects to Xero login

### 3. Verify Database Connectivity

Check Supabase logs for connection from Vercel IPs.

### 4. Monitor Sentry

Check Sentry dashboard for:
- No unexpected errors
- Source maps uploaded correctly
- Release tracking enabled

### 5. Check Analytics

Vercel Analytics should start collecting data within 24 hours.

---

## 11. Monitoring & Alerts

### Set Up Alerts

**Vercel Notifications:**
- Deployment failures
- Build errors
- High error rates

**Sentry Alerts:**
- New error types
- Error spike alerts
- Performance degradation

**Uptime Monitoring:**
- Health check failures
- Response time > 5 seconds

### Dashboard Monitoring

Monitor the autonomous agent dashboard:

```
https://your-domain.vercel.app/dashboard/agent-monitor
```

This provides real-time system health from internal agents.

---

## 12. Rollback Procedure

If deployment fails:

1. **Revert via Vercel Dashboard**
   - Go to Deployments
   - Find previous working deployment
   - Click "Promote to Production"

2. **Revert via Git**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Emergency Fix**
   - Create hotfix branch
   - Fix issue
   - Deploy directly to production

---

## 13. Performance Optimization

### Caching Strategy

- ✅ Static assets cached (1 year)
- ✅ API responses cached (where appropriate)
- ✅ Database queries cached (5 minutes)

### Bundle Optimization

- ✅ Code splitting enabled
- ✅ Dynamic imports for heavy components
- ✅ Console logs removed in production
- ✅ Source maps uploaded to Sentry

### Database Optimization

- ✅ Connection pooling (handled by Supabase)
- ✅ Indexes on frequently queried columns
- ✅ Query optimization for large datasets

---

## 14. Cost Optimization

### Vercel Costs

- **Free Tier**: 100GB bandwidth, 100 deployments/day
- **Pro Tier**: $20/month - unlimited deployments

### Supabase Costs

- **Free Tier**: 500MB database, 2GB bandwidth
- **Pro Tier**: $25/month - 8GB database, 50GB bandwidth

### AI API Costs

- **Google Gemini**: ~$0.00036 per transaction
- **Estimated**: ~$4.40 for 12,236 transactions

### Optimization Tips

1. **Cache AI Results**: Avoid re-analyzing same transactions
2. **Batch Operations**: Process transactions in batches
3. **Use Quick Health Checks**: Skip AI model tests for monitoring
4. **Optimize Images**: Use Next.js Image component
5. **Enable Compression**: Vercel handles automatically

---

## 15. Troubleshooting

### Common Issues

**Issue**: Build fails with "Missing environment variable"
- **Solution**: Add variable in Vercel dashboard and redeploy

**Issue**: Health check returns 503
- **Solution**: Check Supabase connection and environment variables

**Issue**: Sentry not receiving errors
- **Solution**: Verify `SENTRY_DSN` is set and source maps uploaded

**Issue**: Rate limit errors
- **Solution**: Increase limits in `lib/middleware/rate-limit.ts`

**Issue**: Slow API responses
- **Solution**: Check Supabase query performance and add indexes

---

## 16. Production Checklist

Before going live:

### Security
- [ ] All secrets rotated for production
- [ ] HTTPS enforced (Vercel default)
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented

### Monitoring
- [ ] Sentry configured and tested
- [ ] Health checks responding
- [ ] Uptime monitoring configured
- [ ] Analytics enabled
- [ ] Alert rules configured

### Performance
- [ ] Build optimized (< 3MB)
- [ ] Core Web Vitals passing
- [ ] API response times < 1s
- [ ] Database indexes added
- [ ] Caching enabled

### Functionality
- [ ] Authentication working
- [ ] Xero integration tested
- [ ] AI analysis functional
- [ ] All dashboards loading
- [ ] Reports generating
- [ ] Agent monitoring active

### Documentation
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Rollback procedure tested
- [ ] Runbook created
- [ ] Team trained

---

## 17. Support & Maintenance

### Log Access

**Vercel Logs:**
```bash
vercel logs https://your-domain.vercel.app
```

**Supabase Logs:**
- Access via Supabase Dashboard → Logs

**Sentry Errors:**
- Access via Sentry Dashboard → Issues

### Regular Maintenance

**Weekly:**
- Review error logs in Sentry
- Check performance metrics
- Verify health checks passing

**Monthly:**
- Rotate API keys
- Update dependencies
- Review cost usage
- Check for security updates

**Quarterly:**
- Security audit
- Performance optimization review
- Disaster recovery test

---

## 18. Next Steps

After successful deployment:

1. **Configure Custom Domain**
   - Add domain in Vercel dashboard
   - Update DNS records
   - Update `NEXTAUTH_URL` and `XERO_REDIRECT_URI`

2. **Enable Advanced Features**
   - Multi-tenant support
   - PDF report generation
   - Email notifications

3. **Scale Infrastructure**
   - Upgrade Vercel plan if needed
   - Upgrade Supabase plan for more connections
   - Implement Redis for distributed caching

---

## Contact & Support

**Technical Issues:**
- Check Sentry dashboard
- Review Vercel logs
- Contact Vercel support

**Application Issues:**
- Check `/dashboard/agent-monitor` for system health
- Review `/api/health` endpoint
- Check Supabase logs

---

**Last Updated**: 2026-01-28
**Version**: 1.0.0
**Status**: ✅ Production Ready
