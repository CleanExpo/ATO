# Autonomous Agent System - Quick Start Guide

## 🚀 Overview

The autonomous agent system continuously monitors your ATO application, identifies issues, and recommends improvements while your AI analysis runs.

## ✅ System Status

**Current State:**
- ✅ 5 monitoring agents implemented and tested
- ✅ CLI interface working
- ✅ Dashboard available at `/dashboard/agent-monitor`
- ✅ Agents running successfully (analysis at 0.8%, 100/12,236 transactions)
- ⚠️ Database migration pending (agents work without it)

## 🎯 Quick Start

### Option 1: Run Continuously (Recommended)

Open a **new terminal window** and run:

```bash
cd C:\ATO\ato-app
npm run agents:start
```

This will:
- Run all 5 agents every 5 minutes
- Display findings and recommendations in real-time
- Keep monitoring until you press Ctrl+C

**Keep this terminal open** while your AI analysis completes (~3-4 hours).

### Option 2: Run Individual Agents

Test specific agents on-demand:

```bash
npm run agents:run analysis-monitor   # Check AI analysis progress
npm run agents:run data-quality       # Validate transaction quality
npm run agents:run api-health         # Test API endpoints
npm run agents:run schema-validation  # Verify database schema
npm run agents:run tax-data-freshness # Check tax rate freshness
```

### Option 3: View Dashboard

Open your browser to:
```
http://localhost:3000/dashboard/agent-monitor
```

The dashboard auto-refreshes every 10 seconds showing:
- Agent status (healthy/warning/error)
- Recent findings
- Prioritized recommendations
- Critical issues highlighted

## 📊 What Each Agent Monitors

### 1. Analysis Monitor
- **Purpose**: Track AI analysis progress
- **Checks**: Progress stalls, errors, cost anomalies
- **Frequency**: Every 5 minutes
- **Current Status**: ✅ Healthy (0.8% complete, 100/12,236 transactions)

### 2. Data Quality
- **Purpose**: Validate analyzed transactions
- **Checks**: Missing fields, low confidence scores, data inconsistencies
- **Frequency**: Every 5 minutes
- **Current Status**: ✅ Healthy (Quality Score: 100)

### 3. API Health
- **Purpose**: Monitor endpoint performance
- **Checks**: Response times, status codes, availability
- **Frequency**: Every 5 minutes
- **Current Status**: ✅ Healthy (4/4 endpoints, 556ms avg)

### 4. Schema Validation
- **Purpose**: Verify database schema
- **Checks**: Missing columns, misnamed fields, schema drift
- **Frequency**: Every 5 minutes

### 5. Tax Data Freshness
- **Purpose**: Check if tax rates are current
- **Checks**: Compares hardcoded values against ATO.gov.au
- **Frequency**: Every 5 minutes
- **Uses**: Jina AI to scrape current rates

## 📋 Database Migration (Optional)

The agents work perfectly **without** database storage - they output reports to console.

To enable database storage of findings:

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Run this SQL:

```sql
-- Create agent_reports table
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_reports_created_at ON agent_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_id ON agent_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_status ON agent_reports(status);
CREATE INDEX IF NOT EXISTS idx_agent_reports_agent_created ON agent_reports(agent_id, created_at DESC);

-- Create view
CREATE OR REPLACE VIEW latest_agent_reports AS
SELECT DISTINCT ON (agent_id)
  id, agent_id, status, findings, recommendations, metadata, created_at
FROM agent_reports
ORDER BY agent_id, created_at DESC;

-- Enable RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY IF NOT EXISTS "Service role can manage agent reports" ON agent_reports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

After running the SQL:
- Restart the orchestrator if it's running
- Reports will now be stored in database
- Dashboard will show historical data

## 🔧 CLI Commands Reference

```bash
npm run agents:start              # Start orchestrator (continuous)
npm run agents:run <agent-name>   # Run specific agent once
npm run agents:report             # View last 10 reports
npm run agents:report <agent> 20  # View last 20 from specific agent
npm run agents:stop               # Stop (Ctrl+C in the terminal)
npm run agents:help               # Show help
```

## 📈 Expected Behavior

### During AI Analysis (Now - Next 3-4 hours)

The orchestrator will:
- ✅ Monitor progress every 5 minutes
- ✅ Detect if analysis stalls (no progress for 15+ minutes)
- ✅ Alert on errors or unexpected costs
- ✅ Validate data quality as transactions are analyzed
- ✅ Check API health continuously

### When Analysis Completes

You'll see recommendations like:
- Generate final reports
- Validate all results
- Check for R&D candidates
- Review tax opportunities

## 🎯 Next Steps

1. **Open a new terminal** and run:
   ```bash
   npm run agents:start
   ```

2. **Open the dashboard** in your browser:
   ```
   http://localhost:3000/dashboard/agent-monitor
   ```

3. **Let it run** while your AI analysis completes

4. **Check findings** every 30-60 minutes via dashboard or terminal

5. **Act on recommendations** as critical issues appear

## 💡 Tips

- **Keep the orchestrator running** in a separate terminal
- **Check the dashboard** periodically for critical issues
- **Agents are non-intrusive** - they only read data, never modify
- **Safe to restart** - agents are stateless, no data loss
- **Works offline** - doesn't require internet (except tax data freshness)

## 🐛 Troubleshooting

**Problem**: "supabaseUrl is required" error
- **Solution**: Make sure `.env.local` is in the project root

**Problem**: Agents not finding data
- **Solution**: Wait for AI analysis to process more transactions (currently 0.8%)

**Problem**: Dashboard shows "No Agent Reports Yet"
- **Solution**: Run `npm run agents:start` in a separate terminal

**Problem**: Can't see reports in database
- **Solution**: Run the database migration SQL (optional - agents work without it)

## 📞 Support

Run `npm run agents:help` for command reference.

Check the dashboard at `/dashboard/agent-monitor` for real-time status.

---

**Current Status**: System operational ✅
**AI Analysis**: 0.8% complete (100/12,236 transactions)
**Estimated Time**: ~3-4 hours remaining
