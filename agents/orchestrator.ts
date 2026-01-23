import { Agent, AgentReport, Task, Finding } from './types'
import { AnalysisMonitorAgent } from './monitors/analysis-monitor'
import { DataQualityAgent } from './monitors/data-quality'
import { APIHealthAgent } from './monitors/api-health'
import { SchemaValidationAgent } from './monitors/schema-validation'
import { TaxDataFreshnessAgent } from './monitors/tax-data-freshness'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export class OrchestratorAgent {
  private agents: Agent[]
  private taskQueue: Task[] = []
  private findings: Finding[] = []
  private tenantId: string
  private supabase: SupabaseClient
  private isRunning: boolean = false
  private intervalId?: NodeJS.Timeout

  constructor(tenantId: string) {
    this.tenantId = tenantId

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Initialize all monitoring agents
    this.agents = [
      new AnalysisMonitorAgent(tenantId),
      new DataQualityAgent(tenantId),
      new APIHealthAgent(tenantId),
      new SchemaValidationAgent(tenantId),
      new TaxDataFreshnessAgent(tenantId)
    ]
  }

  /**
   * Start the orchestrator - runs all agents every 5 minutes
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Orchestrator already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting Autonomous Agent Orchestrator')
    console.log(`   Monitoring tenant: ${this.tenantId}`)
    console.log(`   Agents: ${this.agents.length}`)
    console.log('')

    // Run immediately on start
    await this.runAllAgents()

    // Then run every 5 minutes
    this.intervalId = setInterval(async () => {
      await this.runAllAgents()
    }, 5 * 60 * 1000) // 5 minutes

    console.log('✅ Orchestrator started - monitoring every 5 minutes')
  }

  /**
   * Stop the orchestrator
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.isRunning = false
    console.log('🛑 Orchestrator stopped')
  }

  /**
   * Run all agents in parallel and collect reports
   */
  private async runAllAgents() {
    console.log(`\n⏰ [${new Date().toISOString()}] Running all agents...`)

    const startTime = Date.now()

    try {
      // Execute all agents in parallel
      const reports = await Promise.all(
        this.agents.map(agent =>
          agent.execute().catch(error => {
            console.error(`❌ Agent failed:`, error)
            return {
              agentId: 'unknown',
              status: 'error' as const,
              findings: [{
                type: 'agent-error',
                severity: 'critical' as const,
                description: `Agent execution failed: ${error.message}`,
                timestamp: new Date()
              }],
              recommendations: [],
              timestamp: new Date()
            }
          })
        )
      )

      const duration = Date.now() - startTime

      // Process reports
      await this.processReports(reports)

      // Log summary
      this.logSummary(reports, duration)

    } catch (error) {
      console.error('❌ Failed to run agents:', error)
    }
  }

  /**
   * Process agent reports and update task queue
   */
  private async processReports(reports: AgentReport[]) {
    for (const report of reports) {
      // Store report in database
      await this.storeReport(report)

      // Collect all findings
      this.findings.push(...report.findings)

      // Convert recommendations to tasks
      if (report.recommendations.length > 0) {
        for (const recommendation of report.recommendations) {
          const task: Task = {
            id: `${report.agentId}-${Date.now()}`,
            type: report.agentId,
            priority: recommendation.priority,
            description: recommendation.action,
            recommendations: [recommendation],
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          }
          this.taskQueue.push(task)
        }
      }
    }

    // Prioritize task queue
    this.prioritizeTaskQueue()
  }

  /**
   * Store agent report in database
   */
  private async storeReport(report: AgentReport) {
    try {
      const { error } = await this.supabase
        .from('agent_reports')
        .insert({
          agent_id: report.agentId,
          status: report.status,
          findings: report.findings,
          recommendations: report.recommendations,
          metadata: report.metadata,
          created_at: report.timestamp.toISOString()
        })

      if (error) {
        console.error(`Failed to store report for ${report.agentId}:`, error)
      }
    } catch (error) {
      console.error(`Error storing report:`, error)
    }
  }

  /**
   * Prioritize task queue by priority and severity
   */
  private prioritizeTaskQueue() {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

    this.taskQueue.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  /**
   * Log summary of agent reports
   */
  private logSummary(reports: AgentReport[], duration: number) {
    console.log(`\n📊 Agent Execution Summary (${duration}ms)`)
    console.log('─'.repeat(60))

    for (const report of reports) {
      const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        error: '❌'
      }[report.status]

      console.log(`${statusEmoji} ${report.agentId}`)
      console.log(`   Status: ${report.status}`)
      console.log(`   Findings: ${report.findings.length}`)
      console.log(`   Recommendations: ${report.recommendations.length}`)

      // Show critical findings
      const criticalFindings = report.findings.filter(f => f.severity === 'critical')
      if (criticalFindings.length > 0) {
        console.log(`   🚨 Critical Issues: ${criticalFindings.length}`)
        criticalFindings.forEach(f => {
          console.log(`      - ${f.description}`)
        })
      }
    }

    console.log('─'.repeat(60))
    console.log(`📋 Task Queue: ${this.taskQueue.length} pending tasks`)

    // Show top 3 priority tasks
    const topTasks = this.taskQueue.slice(0, 3)
    if (topTasks.length > 0) {
      console.log('\n🎯 Top Priority Tasks:')
      topTasks.forEach((task, i) => {
        console.log(`   ${i + 1}. [${task.priority.toUpperCase()}] ${task.description}`)
      })
    }

    console.log('')
  }

  /**
   * Get current task queue
   */
  getTaskQueue(): Task[] {
    return this.taskQueue
  }

  /**
   * Get all findings
   */
  getFindings(): Finding[] {
    return this.findings
  }

  /**
   * Get status of orchestrator
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      agentsCount: this.agents.length,
      taskQueueLength: this.taskQueue.length,
      findingsCount: this.findings.length
    }
  }
}
