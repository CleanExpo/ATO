/**
 * Turing Advisor - Algorithmic Efficiency
 *
 * Named after Alan Turing, father of computer science.
 * Analyses algorithmic complexity, identifies bottlenecks,
 * and recommends optimisation strategies.
 *
 * Key Principles:
 * - O(n) is acceptable, O(n²) is a warning, O(2^n) is critical
 * - N+1 queries are the most common performance killer
 * - Caching should be used strategically, not everywhere
 * - Memory vs speed tradeoffs must be explicit
 */

import {
  Advisor,
  AdvisorRecommendation,
  AlgorithmicAnalysis,
  CouncilContext,
  ComplexityClass,
  TuringContext,
  COMPLEXITY_THRESHOLDS
} from '../types'

export class TuringAdvisor implements Advisor {
  name = 'turing' as const

  async analyse(context: CouncilContext): Promise<AdvisorRecommendation> {
    const turingContext = context.turing || this.inferContext(context)
    const analysis = await this.performAnalysis(turingContext)

    return {
      advisor: this.name,
      recommendation: this.generateRecommendation(analysis),
      confidence: this.calculateConfidence(analysis),
      reasoning: this.generateReasoning(analysis),
      metrics: {
        timeComplexityScore: this.complexityToScore(analysis.timeComplexity),
        spaceComplexityScore: this.complexityToScore(analysis.spaceComplexity),
        optimisationPotential: analysis.optimisationPotential,
        queryCount: analysis.queryCount || 0,
        cacheHitRate: analysis.cacheHitRate || 0
      },
      timestamp: new Date()
    }
  }

  private inferContext(context: CouncilContext): TuringContext {
    // Infer algorithmic context from general council context
    const dataSize = this.estimateDataSize(context)
    const operation = context.type

    return {
      operation,
      dataSize,
      queryPatterns: this.inferQueryPatterns(context),
      executionTime: undefined,
      memoryUsage: undefined
    }
  }

  private estimateDataSize(context: CouncilContext): number {
    // Estimate based on operation type
    switch (context.type) {
      case 'data-sync':
        return 10000 // Assume large data sync
      case 'analysis-request':
        return 5000 // Medium dataset
      case 'report-generation':
        return 1000 // Smaller processed data
      case 'monitoring-cycle':
        return 100 // Quick checks
      default:
        return 500
    }
  }

  private inferQueryPatterns(context: CouncilContext): string[] {
    const patterns: string[] = []

    switch (context.type) {
      case 'data-sync':
        patterns.push('bulk-insert', 'upsert-many', 'transaction')
        break
      case 'analysis-request':
        patterns.push('aggregation', 'join', 'window-function')
        break
      case 'report-generation':
        patterns.push('select-with-join', 'group-by', 'order-by')
        break
      case 'monitoring-cycle':
        patterns.push('count', 'exists', 'simple-select')
        break
    }

    return patterns
  }

  private async performAnalysis(context: TuringContext): Promise<AlgorithmicAnalysis> {
    const timeComplexity = this.analyseTimeComplexity(context)
    const spaceComplexity = this.analyseSpaceComplexity(context)
    const bottlenecks = this.identifyBottlenecks(context)
    const recommendations = this.generateOptimisations(context, bottlenecks)
    const optimisationPotential = this.calculateOptimisationPotential(
      timeComplexity,
      spaceComplexity,
      bottlenecks
    )

    return {
      timeComplexity,
      spaceComplexity,
      optimisationPotential,
      bottlenecks,
      recommendations,
      queryCount: this.estimateQueryCount(context),
      cacheHitRate: 0.7 // Default assumption, would be measured in production
    }
  }

  private analyseTimeComplexity(context: TuringContext): ComplexityClass {
    const { operation, dataSize, queryPatterns = [] } = context

    // Check for known expensive patterns
    if (queryPatterns.includes('nested-loop') || queryPatterns.includes('cartesian-product')) {
      return 'O(n²)'
    }

    if (queryPatterns.includes('recursive') || queryPatterns.includes('permutation')) {
      return 'O(2^n)'
    }

    if (queryPatterns.includes('sort') || queryPatterns.includes('order-by')) {
      return 'O(n log n)'
    }

    // Size-based heuristics
    if (dataSize > 10000) {
      if (operation === 'analysis-request') return 'O(n log n)'
      if (operation === 'data-sync') return 'O(n)'
    }

    if (queryPatterns.includes('aggregation') || queryPatterns.includes('group-by')) {
      return 'O(n)'
    }

    if (queryPatterns.includes('index-lookup') || queryPatterns.includes('hash-lookup')) {
      return 'O(log n)'
    }

    if (queryPatterns.includes('simple-select') || queryPatterns.includes('exists')) {
      return 'O(1)'
    }

    // Default to linear for safety
    return 'O(n)'
  }

  private analyseSpaceComplexity(context: TuringContext): ComplexityClass {
    const { operation, dataSize } = context

    // Report generation often creates large intermediate results
    if (operation === 'report-generation' && dataSize > 5000) {
      return 'O(n)'
    }

    // Data sync may need to hold all data in memory
    if (operation === 'data-sync') {
      return dataSize > 10000 ? 'O(n)' : 'O(log n)'
    }

    // Analysis might create aggregated results
    if (operation === 'analysis-request') {
      return 'O(log n)' // Assuming aggregation reduces size
    }

    return 'O(1)' // Most operations should be constant space
  }

  private identifyBottlenecks(context: TuringContext): string[] {
    const bottlenecks: string[] = []
    const { queryPatterns = [], dataSize, operation } = context

    // N+1 query detection
    if (operation === 'data-sync' && !queryPatterns.includes('batch')) {
      bottlenecks.push('Potential N+1 query pattern - consider batching')
    }

    // Large dataset without pagination
    if (dataSize > 1000 && !queryPatterns.includes('pagination')) {
      bottlenecks.push('Large dataset without pagination - memory pressure risk')
    }

    // Missing indexes
    if (queryPatterns.includes('full-table-scan')) {
      bottlenecks.push('Full table scan detected - add appropriate indexes')
    }

    // Inefficient joins
    if (queryPatterns.includes('join') && dataSize > 5000) {
      bottlenecks.push('Large join operation - ensure join columns are indexed')
    }

    // No caching
    if (operation === 'analysis-request' && !queryPatterns.includes('cached')) {
      bottlenecks.push('Repeated analysis without caching - consider memoisation')
    }

    return bottlenecks
  }

  private generateOptimisations(
    context: TuringContext,
    bottlenecks: string[]
  ): string[] {
    const recommendations: string[] = []

    // Address each bottleneck
    for (const bottleneck of bottlenecks) {
      if (bottleneck.includes('N+1')) {
        recommendations.push('Use batch queries with IN clause or join fetch')
      }
      if (bottleneck.includes('pagination')) {
        recommendations.push('Implement cursor-based pagination')
      }
      if (bottleneck.includes('table scan')) {
        recommendations.push('Add composite index on frequently queried columns')
      }
      if (bottleneck.includes('join')) {
        recommendations.push('Ensure foreign keys are indexed')
      }
      if (bottleneck.includes('caching')) {
        recommendations.push('Implement TTL-based cache with stale-while-revalidate')
      }
    }

    // Size-specific recommendations
    if (context.dataSize > 10000) {
      recommendations.push('Consider streaming/chunked processing for large datasets')
    }

    // Operation-specific recommendations
    if (context.operation === 'report-generation') {
      recommendations.push('Pre-aggregate common report metrics')
      recommendations.push('Generate reports asynchronously with progress tracking')
    }

    return [...new Set(recommendations)] // Deduplicate
  }

  private calculateOptimisationPotential(
    timeComplexity: ComplexityClass,
    spaceComplexity: ComplexityClass,
    bottlenecks: string[]
  ): number {
    let potential = 0

    // Time complexity contribution
    const complexityScores: Record<ComplexityClass, number> = {
      'O(2^n)': 0.9,
      'O(n²)': 0.7,
      'O(n log n)': 0.4,
      'O(n)': 0.2,
      'O(log n)': 0.1,
      'O(1)': 0
    }

    potential += complexityScores[timeComplexity] * 0.4
    potential += complexityScores[spaceComplexity] * 0.2
    potential += Math.min(bottlenecks.length * 0.1, 0.4)

    return Math.min(potential, 1)
  }

  private estimateQueryCount(context: TuringContext): number {
    const { operation, dataSize, queryPatterns = [] } = context

    // Base query count by operation
    let baseCount = 1

    switch (operation) {
      case 'data-sync':
        baseCount = queryPatterns.includes('batch') ? Math.ceil(dataSize / 100) : dataSize
        break
      case 'analysis-request':
        baseCount = 5 // Typically multiple aggregation queries
        break
      case 'report-generation':
        baseCount = 10 // Multiple sections
        break
      case 'monitoring-cycle':
        baseCount = 5 // Health checks
        break
    }

    return baseCount
  }

  private generateRecommendation(analysis: AlgorithmicAnalysis): string {
    const { timeComplexity, bottlenecks, recommendations } = analysis

    if (this.isComplexityCritical(timeComplexity)) {
      return `CRITICAL: Algorithm has ${timeComplexity} complexity. ${recommendations[0] || 'Immediate optimisation required.'}`
    }

    if (this.isComplexityWarning(timeComplexity)) {
      return `WARNING: Algorithm has ${timeComplexity} complexity. ${recommendations[0] || 'Consider optimisation.'}`
    }

    if (bottlenecks.length > 0) {
      return `OPTIMISE: ${bottlenecks.length} bottleneck(s) identified. Primary: ${bottlenecks[0]}`
    }

    return `ACCEPTABLE: Algorithm performs at ${timeComplexity}. No immediate optimisation needed.`
  }

  private generateReasoning(analysis: AlgorithmicAnalysis): string {
    const parts: string[] = []

    parts.push(`Time complexity: ${analysis.timeComplexity}`)
    parts.push(`Space complexity: ${analysis.spaceComplexity}`)
    parts.push(`Optimisation potential: ${(analysis.optimisationPotential * 100).toFixed(0)}%`)

    if (analysis.bottlenecks.length > 0) {
      parts.push(`Bottlenecks: ${analysis.bottlenecks.join('; ')}`)
    }

    if (analysis.queryCount) {
      parts.push(`Estimated queries: ${analysis.queryCount}`)
    }

    return parts.join('. ')
  }

  private calculateConfidence(analysis: AlgorithmicAnalysis): number {
    // Higher confidence when we have more data
    let confidence = 0.6 // Base confidence

    if (analysis.queryCount !== undefined) confidence += 0.1
    if (analysis.cacheHitRate !== undefined) confidence += 0.1
    if (analysis.bottlenecks.length > 0) confidence += 0.1 // We found something concrete

    // Lower confidence for extreme complexities (might be misanalysed)
    if (analysis.timeComplexity === 'O(2^n)') confidence -= 0.1

    return Math.min(Math.max(confidence, 0.3), 0.95)
  }

  private complexityToScore(complexity: ComplexityClass): number {
    const scores: Record<ComplexityClass, number> = {
      'O(1)': 100,
      'O(log n)': 90,
      'O(n)': 70,
      'O(n log n)': 50,
      'O(n²)': 20,
      'O(2^n)': 5
    }
    return scores[complexity]
  }

  private isComplexityCritical(complexity: ComplexityClass): boolean {
    return complexity === COMPLEXITY_THRESHOLDS.critical
  }

  private isComplexityWarning(complexity: ComplexityClass): boolean {
    return complexity === COMPLEXITY_THRESHOLDS.warning
  }
}
