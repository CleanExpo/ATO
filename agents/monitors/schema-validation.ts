import { Agent, AgentReport } from '../types'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export class SchemaValidationAgent extends Agent {
  private supabase: SupabaseClient

  // Expected columns in forensic_analysis_results table
  private expectedColumns = [
    'id',
    'tenant_id',
    'transaction_id',
    'financial_year',
    'transaction_amount',
    'primary_category',
    'secondary_categories',
    'category_confidence',
    'is_rnd_candidate',
    'meets_div355_criteria',
    'rnd_activity_type',
    'rnd_confidence',
    'rnd_reasoning',
    'div355_outcome_unknown',
    'div355_systematic_approach',
    'div355_new_knowledge',
    'div355_scientific_method',
    'is_fully_deductible',
    'deduction_type',
    'claimable_amount', // ← Not adjusted_benefit!
    'deduction_restrictions',
    'deduction_confidence',
    'requires_documentation',
    'fbt_implications',
    'division7a_risk',
    'compliance_notes',
    'analyzed_at',
    'ai_model'
  ]

  constructor(tenantId: string) {
    super('schema-validation', tenantId)
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Query PostgreSQL information schema to get actual columns
      const { data: columns, error } = await this.supabase
        .rpc('get_table_schema', {
          table_name: 'forensic_analysis_results'
        })
        .select('column_name, data_type, is_nullable')

      if (error) {
        // If RPC doesn't exist, try direct query
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('forensic_analysis_results')
          .select('*')
          .limit(1)

        if (fallbackError) {
          return this.createReport(
            'error',
            [
              this.createFinding(
                'schema-query-failed',
                'high',
                `Cannot query database schema: ${error.message}`,
                { error }
              )
            ],
            [
              this.createRecommendation(
                'high',
                'Create RPC function for schema inspection or verify table exists',
                'Schema validation requires database access',
                '30 minutes'
              )
            ]
          )
        }

        // Extract columns from sample data
        const actualColumns = fallbackData && fallbackData.length > 0
          ? Object.keys(fallbackData[0])
          : []

        return this.validateColumns(actualColumns, startTime)
      }

      const actualColumns = (Array.isArray(columns) ? columns : [columns]).map((c: unknown) => {
        if (c && typeof c === 'object' && 'column_name' in c && typeof c.column_name === 'string') {
          return c.column_name
        }
        return ''
      }).filter((name: string) => name !== '')

      return this.validateColumns(actualColumns, startTime)

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      return this.createReport(
        'error',
        [
          this.createFinding(
            'agent-error',
            'critical',
            `Failed to validate schema: ${errorMessage}`,
            { error: errorStack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug schema validation agent',
            'Agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  private validateColumns(actualColumns: string[], startTime: number): AgentReport {
    const findings = []
    const recommendations = []

    // Find missing columns
    const missing = this.expectedColumns.filter(col => !actualColumns.includes(col))

    if (missing.length > 0) {
      findings.push(
        this.createFinding(
          'missing-columns',
          'high',
          `${missing.length} expected column(s) missing from forensic_analysis_results`,
          { missingColumns: missing }
        )
      )

      recommendations.push(
        this.createRecommendation(
          'high',
          'Run database migration to add missing columns',
          'Missing columns will cause analysis errors',
          '1 hour'
        )
      )
    }

    // Find unexpected columns (might indicate schema drift)
    const extra = actualColumns.filter(col => !this.expectedColumns.includes(col))

    if (extra.length > 0) {
      findings.push(
        this.createFinding(
          'unexpected-columns',
          'low',
          `${extra.length} unexpected column(s) found in forensic_analysis_results`,
          { extraColumns: extra }
        )
      )

      recommendations.push(
        this.createRecommendation(
          'low',
          'Review schema documentation or remove unused columns',
          'Unexpected columns may indicate schema drift',
          '30 minutes'
        )
      )
    }

    // Check for common misnamed columns
    if (actualColumns.includes('adjusted_benefit') && !actualColumns.includes('claimable_amount')) {
      findings.push(
        this.createFinding(
          'column-name-mismatch',
          'critical',
          'Table has "adjusted_benefit" column but code expects "claimable_amount"',
          {
            expectedColumn: 'claimable_amount',
            foundColumn: 'adjusted_benefit'
          }
        )
      )

      recommendations.push(
        this.createRecommendation(
          'critical',
          'Rename column adjusted_benefit to claimable_amount or update code',
          'Column name mismatch will cause API failures',
          '30 minutes'
        )
      )
    }

    const executionTime = Date.now() - startTime

    // Determine overall status
    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    if (findings.some(f => f.severity === 'critical')) {
      status = 'error'
    } else if (findings.some(f => f.severity === 'high' || f.severity === 'medium')) {
      status = 'warning'
    }

    return this.createReport(status, findings, recommendations, {
      executionTime,
      expectedColumnsCount: this.expectedColumns.length,
      actualColumnsCount: actualColumns.length,
      matchPercentage: Math.round(
        ((this.expectedColumns.length - missing.length) / this.expectedColumns.length) * 100
      ),
      lastRun: new Date()
    })
  }
}
