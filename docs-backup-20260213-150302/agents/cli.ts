#!/usr/bin/env tsx

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') })
import { OrchestratorAgent } from './orchestrator'
import { AnalysisMonitorAgent } from './monitors/analysis-monitor'
import { DataQualityAgent } from './monitors/data-quality'
import { APIHealthAgent } from './monitors/api-health'
import { SchemaValidationAgent } from './monitors/schema-validation'
import { TaxDataFreshnessAgent } from './monitors/tax-data-freshness'
import { Agent } from './types'
import { createClient } from '@supabase/supabase-js'

// Get tenant ID from environment or use default
const TENANT_ID = process.env.TENANT_ID || '8a8caf6c-614b-45a5-9e15-46375122407c'

const commands: Record<string, (args: string[]) => Promise<void> | void> = {
  start: startOrchestrator,
  run: runSingleAgent,
  report: showReports,
  stop: stopOrchestrator,
  help: showHelp
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  if (command in commands) {
    await commands[command](args.slice(1))
  } else {
    console.error(`❌ Unknown command: ${command}`)
    showHelp([])
    process.exit(1)
  }
}

async function startOrchestrator(_args: string[]) {
  console.log('🚀 Starting Autonomous Agent Orchestrator')
  console.log(`   Tenant ID: ${TENANT_ID}`)
  console.log('')

  const orchestrator = new OrchestratorAgent(TENANT_ID)

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Received SIGINT, shutting down...')
    orchestrator.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down...')
    orchestrator.stop()
    process.exit(0)
  })

  await orchestrator.start()

  // Keep process running
  await new Promise(() => {})
}

async function runSingleAgent(args: string[]) {
  const agentName = args[0]

  if (!agentName) {
    console.error('❌ Please specify an agent name')
    console.log('Available agents:')
    console.log('  - analysis-monitor')
    console.log('  - data-quality')
    console.log('  - api-health')
    console.log('  - schema-validation')
    console.log('  - tax-data-freshness')
    process.exit(1)
  }

  console.log(`🔍 Running agent: ${agentName}`)
  console.log(`   Tenant ID: ${TENANT_ID}`)
  console.log('')

  let agent: Agent

  switch (agentName) {
    case 'analysis-monitor':
      agent = new AnalysisMonitorAgent(TENANT_ID)
      break
    case 'data-quality':
      agent = new DataQualityAgent(TENANT_ID)
      break
    case 'api-health':
      agent = new APIHealthAgent(TENANT_ID)
      break
    case 'schema-validation':
      agent = new SchemaValidationAgent(TENANT_ID)
      break
    case 'tax-data-freshness':
      agent = new TaxDataFreshnessAgent(TENANT_ID)
      break
    default:
      console.error(`❌ Unknown agent: ${agentName}`)
      process.exit(1)
  }

  const startTime = Date.now()
  const report = await agent.execute()
  const duration = Date.now() - startTime

  // Display report
  console.log('─'.repeat(60))
  console.log(`📊 Agent Report: ${report.agentId}`)
  console.log(`   Status: ${report.status}`)
  console.log(`   Execution Time: ${duration}ms`)
  console.log('─'.repeat(60))

  if (report.findings.length > 0) {
    console.log(`\n🔍 Findings (${report.findings.length}):`)
    report.findings.forEach((finding, i) => {
      const emoji = {
        low: 'ℹ️',
        medium: '⚠️',
        high: '🔴',
        critical: '🚨'
      }[finding.severity]

      console.log(`\n${i + 1}. ${emoji} [${finding.severity.toUpperCase()}] ${finding.type}`)
      console.log(`   ${finding.description}`)
      if (finding.details) {
        console.log(`   Details:`, JSON.stringify(finding.details, null, 2).split('\n').map(l => `   ${l}`).join('\n'))
      }
    })
  } else {
    console.log('\n✅ No findings - all checks passed')
  }

  if (report.recommendations.length > 0) {
    console.log(`\n💡 Recommendations (${report.recommendations.length}):`)
    report.recommendations.forEach((rec, i) => {
      console.log(`\n${i + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`)
      console.log(`   Reason: ${rec.reason}`)
      if (rec.estimatedEffort) {
        console.log(`   Estimated Effort: ${rec.estimatedEffort}`)
      }
    })
  }

  if (report.metadata) {
    console.log(`\n📈 Metadata:`)
    console.log(JSON.stringify(report.metadata, null, 2).split('\n').map(l => `   ${l}`).join('\n'))
  }

  console.log('\n' + '─'.repeat(60))
}

async function showReports(args: string[]) {
  const agentId = args[0] // Optional: filter by agent
  const limit = parseInt(args[1] || '10')

  console.log('📋 Recent Agent Reports')
  if (agentId) {
    console.log(`   Agent: ${agentId}`)
  }
  console.log(`   Limit: ${limit}`)
  console.log('')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('agent_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data: reports, error } = await query

  if (error) {
    console.error('❌ Failed to fetch reports:', error.message)
    process.exit(1)
  }

  if (!reports || reports.length === 0) {
    console.log('ℹ️  No reports found')
    return
  }

  console.log('─'.repeat(80))

  interface AgentReport {
    agent_id: string
    status: string
    created_at: string
    findings?: Array<{ severity: string; description: string }>
    recommendations?: unknown[]
  }

  reports.forEach((report: AgentReport, i: number) => {
    const statusEmoji: Record<string, string> = {
      healthy: '✅',
      warning: '⚠️',
      error: '❌'
    }
    const emoji = statusEmoji[report.status] || '❓'

    console.log(`\n${i + 1}. ${emoji} ${report.agent_id}`)
    console.log(`   Status: ${report.status}`)
    console.log(`   Time: ${new Date(report.created_at).toLocaleString()}`)
    console.log(`   Findings: ${report.findings?.length || 0}`)
    console.log(`   Recommendations: ${report.recommendations?.length || 0}`)

    // Show critical findings
    const criticalFindings = report.findings?.filter((f) => f.severity === 'critical') || []
    if (criticalFindings.length > 0) {
      console.log(`   🚨 Critical Issues: ${criticalFindings.length}`)
      criticalFindings.forEach((f) => {
        console.log(`      - ${f.description}`)
      })
    }
  })

  console.log('\n' + '─'.repeat(80))
}

async function stopOrchestrator(_args: string[]) {
  console.log('🛑 Stopping orchestrator...')
  console.log('   (Use Ctrl+C if running in foreground)')
  // This is mainly for documentation - actual stopping happens via SIGINT/SIGTERM
}

function showHelp(_args: string[]) {
  console.log(`
🤖 Autonomous Agent CLI

Usage:
  npm run agents:start              Start the orchestrator (monitors every 5 minutes)
  npm run agents:run <agent-name>   Run a specific agent once
  npm run agents:report [agent] [N] Show recent reports (default: 10)
  npm run agents:stop               Stop the orchestrator
  npm run agents:help               Show this help

Available Agents:
  - analysis-monitor      Monitor AI analysis progress and detect stalls
  - data-quality          Validate analyzed transaction quality
  - api-health            Check API endpoint health and performance
  - schema-validation     Verify database schema matches code expectations
  - tax-data-freshness    Check if tax rates are up-to-date

Examples:
  npm run agents:start
  npm run agents:run data-quality
  npm run agents:report analysis-monitor 20
  npm run agents:report

Environment Variables:
  TENANT_ID               Tenant to monitor (default: 8a8caf6c-614b-45a5-9e15-46375122407c)
  NEXT_PUBLIC_SUPABASE_URL   Supabase URL
  SUPABASE_SERVICE_ROLE_KEY  Supabase service role key
`)
}

// Run CLI
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
