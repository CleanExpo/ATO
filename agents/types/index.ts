// Base types for the autonomous agent system

export interface Finding {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  details?: unknown
  timestamp: Date
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical'
  action: string
  reason: string
  estimatedEffort?: string
  relatedFindings?: string[]
}

export interface AgentReport {
  agentId: string
  status: 'healthy' | 'warning' | 'error'
  findings: Finding[]
  recommendations: Recommendation[]
  metadata?: {
    executionTime?: number
    dataPointsAnalyzed?: number
    lastRun?: Date
  }
  timestamp: Date
}

export interface Task {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendations: Recommendation[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

export abstract class Agent {
  protected agentId: string
  protected tenantId: string

  constructor(agentId: string, tenantId: string) {
    this.agentId = agentId
    this.tenantId = tenantId
  }

  abstract execute(): Promise<AgentReport>

  protected createReport(
    status: 'healthy' | 'warning' | 'error',
    findings: Finding[],
    recommendations: Recommendation[],
    metadata?: Record<string, unknown>
  ): AgentReport {
    return {
      agentId: this.agentId,
      status,
      findings,
      recommendations,
      metadata,
      timestamp: new Date()
    }
  }

  protected createFinding(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    details?: unknown
  ): Finding {
    return {
      type,
      severity,
      description,
      details,
      timestamp: new Date()
    }
  }

  protected createRecommendation(
    priority: 'low' | 'medium' | 'high' | 'critical',
    action: string,
    reason: string,
    estimatedEffort?: string
  ): Recommendation {
    return {
      priority,
      action,
      reason,
      estimatedEffort
    }
  }
}
