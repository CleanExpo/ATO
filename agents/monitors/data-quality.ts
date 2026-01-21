import { Agent, AgentReport } from '../types'
import { createClient } from '@supabase/supabase-js'

export class DataQualityAgent extends Agent {
  private supabase: any

  constructor(tenantId: string) {
    super('data-quality', tenantId)
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  async execute(): Promise<AgentReport> {
    const startTime = Date.now()

    try {
      // Sample recent analyzed transactions
      const { data: samples, error } = await this.supabase
        .from('forensic_analysis_results')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('analyzed_at', { ascending: false })
        .limit(50)

      if (error) {
        return this.createReport(
          'error',
          [
            this.createFinding(
              'database-error',
              'critical',
              `Failed to query analysis results: ${error.message}`,
              { error }
            )
          ],
          [
            this.createRecommendation(
              'critical',
              'Fix database connection or schema',
              'Cannot access analysis results table',
              '1 hour'
            )
          ]
        )
      }

      if (!samples || samples.length === 0) {
        return this.createReport(
          'warning',
          [
            this.createFinding(
              'no-data',
              'medium',
              'No analyzed transactions found in database',
              { sampleSize: 0 }
            )
          ],
          [
            this.createRecommendation(
              'medium',
              'Wait for analysis to complete or check if analysis started',
              'No data available for quality assessment',
              '30 minutes'
            )
          ]
        )
      }

      const findings = []
      const recommendations = []

      // Check 1: Missing required fields
      const missingPrimaryCategory = samples.filter(s => !s.primary_category)
      if (missingPrimaryCategory.length > 0) {
        findings.push(
          this.createFinding(
            'missing-fields',
            'high',
            `${missingPrimaryCategory.length} transactions missing primary_category`,
            { count: missingPrimaryCategory.length, sampleSize: samples.length }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'high',
            'Review AI prompt for category assignment',
            'AI is not consistently assigning categories',
            '2 hours'
          )
        )
      }

      // Check 2: Low confidence scores
      const lowConfidence = samples.filter(s =>
        s.rnd_confidence !== null && s.rnd_confidence < 50
      )
      if (lowConfidence.length > samples.length * 0.3) {
        // More than 30% low confidence
        findings.push(
          this.createFinding(
            'low-confidence',
            'medium',
            `${lowConfidence.length} transactions have low R&D confidence (<50%)`,
            {
              lowConfidenceCount: lowConfidence.length,
              percentage: ((lowConfidence.length / samples.length) * 100).toFixed(1)
            }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'medium',
            'Tune AI model or provide more context in prompts',
            'High percentage of low-confidence results may indicate poor model performance',
            '3 hours'
          )
        )
      }

      // Check 3: Missing financial data
      const missingAmounts = samples.filter(s =>
        !s.transaction_amount && !s.claimable_amount
      )
      if (missingAmounts.length > 0) {
        findings.push(
          this.createFinding(
            'missing-financial-data',
            'high',
            `${missingAmounts.length} transactions missing financial amounts`,
            { count: missingAmounts.length }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'high',
            'Fix transaction parsing or data import',
            'Transactions should always have amount data',
            '2 hours'
          )
        )
      }

      // Check 4: R&D candidates without four-element test
      const rndWithoutTest = samples.filter(s =>
        s.is_rnd_candidate &&
        (!s.div355_outcome_unknown ||
         !s.div355_systematic_approach ||
         !s.div355_new_knowledge ||
         !s.div355_scientific_method)
      )
      if (rndWithoutTest.length > 0) {
        findings.push(
          this.createFinding(
            'incomplete-rnd-assessment',
            'medium',
            `${rndWithoutTest.length} R&D candidates missing four-element test details`,
            { count: rndWithoutTest.length }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'medium',
            'Update R&D analysis to include all four elements',
            'Division 355 requires complete four-element test',
            '2 hours'
          )
        )
      }

      // Check 5: Data consistency - claimable amount vs transaction amount
      const inconsistentAmounts = samples.filter(s =>
        s.claimable_amount && s.transaction_amount &&
        s.claimable_amount > s.transaction_amount
      )
      if (inconsistentAmounts.length > 0) {
        findings.push(
          this.createFinding(
            'data-inconsistency',
            'high',
            `${inconsistentAmounts.length} transactions have claimable amount > transaction amount`,
            {
              count: inconsistentAmounts.length,
              examples: inconsistentAmounts.slice(0, 3).map(s => ({
                id: s.transaction_id,
                claimable: s.claimable_amount,
                transaction: s.transaction_amount
              }))
            }
          )
        )
        recommendations.push(
          this.createRecommendation(
            'high',
            'Fix benefit calculation logic',
            'Claimable amounts should never exceed transaction amounts',
            '1 hour'
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
        dataPointsAnalyzed: samples.length,
        qualityScore: this.calculateQualityScore(samples, findings),
        lastRun: new Date()
      })

    } catch (error: any) {
      return this.createReport(
        'error',
        [
          this.createFinding(
            'agent-error',
            'critical',
            `Failed to analyze data quality: ${error.message}`,
            { error: error.stack }
          )
        ],
        [
          this.createRecommendation(
            'critical',
            'Debug data quality agent',
            'Agent failed to execute properly',
            '1 hour'
          )
        ]
      )
    }
  }

  private calculateQualityScore(samples: any[], findings: any[]): number {
    // Simple quality score: 100 - (issues * 10)
    const issueCount = findings.filter(f =>
      f.severity === 'high' || f.severity === 'critical'
    ).length

    return Math.max(0, 100 - (issueCount * 10))
  }
}
