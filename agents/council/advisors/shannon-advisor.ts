/**
 * Shannon Advisor - Information Theory & Token Economy
 *
 * Named after Claude Shannon, father of information theory.
 * Analyses token efficiency, measures signal-to-noise,
 * and optimises prompt compression for cost reduction.
 *
 * Key Principles:
 * - Entropy measures information content
 * - Redundancy increases cost without adding value
 * - Compression should preserve signal, remove noise
 * - Token budgets must be respected for cost control
 */

import {
  Advisor,
  AdvisorRecommendation,
  CouncilContext,
  InformationAnalysis,
  ShannonContext,
  TokenAnalysis
} from '../types'

export class ShannonAdvisor implements Advisor {
  name = 'shannon' as const

  // Token cost estimates (per 1M tokens, in USD)
  private readonly TOKEN_COSTS = {
    haiku: { input: 0.25, output: 1.25 },
    sonnet: { input: 3.00, output: 15.00 },
    opus: { input: 15.00, output: 75.00 }
  }

  // Token estimation (rough approximation: 1 token ≈ 4 characters)
  private readonly CHARS_PER_TOKEN = 4

  // Common redundant patterns in prompts
  private readonly REDUNDANT_PATTERNS = [
    { pattern: /please\s+/gi, description: 'Polite filler words' },
    { pattern: /I would like you to\s+/gi, description: 'Verbose request prefix' },
    { pattern: /Can you\s+/gi, description: 'Unnecessary question format' },
    { pattern: /\b(very|really|extremely|quite)\b/gi, description: 'Intensifiers' },
    { pattern: /\b(basically|essentially|actually|literally)\b/gi, description: 'Filler adverbs' },
    { pattern: /in order to\s+/gi, description: 'Verbose phrase (use "to")' },
    { pattern: /at this point in time/gi, description: 'Verbose phrase (use "now")' },
    { pattern: /due to the fact that/gi, description: 'Verbose phrase (use "because")' },
    { pattern: /\n{3,}/g, description: 'Excessive newlines' },
    { pattern: /\s{2,}/g, description: 'Multiple spaces' }
  ]

  // Signal words that indicate high-value content
  private readonly SIGNAL_INDICATORS = [
    'must', 'required', 'critical', 'important', 'error', 'fail',
    'return', 'output', 'format', 'structure', 'example', 'constraint',
    'rule', 'condition', 'if', 'when', 'unless', 'except'
  ]

  async analyse(context: CouncilContext): Promise<AdvisorRecommendation> {
    const shannonContext = context.shannon || this.inferContext(context)
    const analysis = await this.performAnalysis(shannonContext)

    return {
      advisor: this.name,
      recommendation: this.generateRecommendation(analysis, shannonContext),
      confidence: this.calculateConfidence(analysis, shannonContext),
      reasoning: this.generateReasoning(analysis, shannonContext),
      metrics: {
        efficiency: analysis.efficiency,
        tokenBudget: analysis.tokenBudget,
        actualUsage: analysis.actualUsage,
        potentialSavings: analysis.estimatedCostSavings,
        redundancyCount: analysis.redundantPatterns.length
      },
      timestamp: new Date()
    }
  }

  private inferContext(context: CouncilContext): ShannonContext {
    // Create minimal context when not provided
    let expectedResponseSize: ShannonContext['expectedResponseSize'] = 'medium'
    let modelTier: ShannonContext['modelTier'] = 'sonnet'

    switch (context.type) {
      case 'monitoring-cycle':
        expectedResponseSize = 'small'
        modelTier = 'haiku'
        break
      case 'analysis-request':
        expectedResponseSize = 'large'
        modelTier = 'sonnet'
        break
      case 'report-generation':
        expectedResponseSize = 'large'
        modelTier = 'opus'
        break
      case 'user-action':
        expectedResponseSize = 'small'
        modelTier = 'haiku'
        break
    }

    return {
      promptContent: JSON.stringify(context),
      expectedResponseSize,
      modelTier,
      maxTokenBudget: this.getDefaultBudget(expectedResponseSize),
      priorityInformation: []
    }
  }

  private getDefaultBudget(size: ShannonContext['expectedResponseSize']): number {
    const budgets = {
      small: 500,
      medium: 2000,
      large: 8000
    }
    return budgets[size]
  }

  private async performAnalysis(context: ShannonContext): Promise<InformationAnalysis> {
    const tokenAnalysis = this.analyseTokens(context.promptContent)
    const redundantPatterns = this.findRedundantPatterns(context.promptContent)
    const compressionOpportunities = this.identifyCompressionOpportunities(
      context.promptContent,
      redundantPatterns
    )
    const efficiency = this.calculateEfficiency(tokenAnalysis, redundantPatterns)
    const recommendations = this.generateOptimisations(
      context,
      tokenAnalysis,
      redundantPatterns
    )
    const estimatedCostSavings = this.estimateCostSavings(
      tokenAnalysis,
      redundantPatterns,
      context.modelTier
    )

    return {
      tokenBudget: context.maxTokenBudget || 2000,
      actualUsage: tokenAnalysis.totalTokens,
      efficiency,
      compressionOpportunities,
      redundantPatterns: redundantPatterns.map(p => p.description),
      recommendations,
      estimatedCostSavings
    }
  }

  private analyseTokens(content: string): TokenAnalysis {
    const inputTokens = this.estimateTokens(content)

    // Estimate output based on typical AI response patterns
    // Responses are usually 1.5-3x input for detailed tasks
    const outputMultiplier = 2
    const outputTokens = Math.ceil(inputTokens * outputMultiplier)
    const totalTokens = inputTokens + outputTokens

    // Calculate signal-to-noise ratio
    const signalToNoise = this.calculateSignalToNoise(content)

    // Calculate redundancy
    const redundancy = this.calculateRedundancy(content)

    // Compression ratio (theoretical minimum vs actual)
    const compressionRatio = outputTokens / inputTokens

    // Overall efficiency
    const efficiency = signalToNoise * (1 - redundancy)

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      compressionRatio,
      signalToNoise,
      redundancy,
      efficiency
    }
  }

  private estimateTokens(content: string): number {
    // GPT-style tokenisation approximation
    // More accurate: count words and add 20% for subword tokens
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    return Math.ceil(wordCount * 1.3) // Adjust for subwords
  }

  private calculateSignalToNoise(content: string): number {
    const words = content.toLowerCase().split(/\s+/)
    let signalCount = 0

    for (const word of words) {
      if (this.SIGNAL_INDICATORS.some(indicator => word.includes(indicator))) {
        signalCount++
      }
    }

    // Signal ratio with smoothing
    const signalRatio = words.length > 0 ? signalCount / words.length : 0

    // Scale to 0-1, where 0.1 signal density is considered good
    return Math.min(signalRatio * 10, 1)
  }

  private calculateRedundancy(content: string): number {
    // Check for repeated phrases
    const phrases = this.extractPhrases(content, 3) // 3-word phrases
    const phraseCount = phrases.length
    const uniquePhrases = new Set(phrases).size

    if (phraseCount === 0) return 0

    // Redundancy = 1 - (unique/total)
    const phraseRedundancy = 1 - (uniquePhrases / phraseCount)

    // Check for pattern matches
    let patternMatchCount = 0
    for (const { pattern } of this.REDUNDANT_PATTERNS) {
      const matches = content.match(pattern)
      if (matches) {
        patternMatchCount += matches.length
      }
    }

    const patternRedundancy = Math.min(patternMatchCount * 0.05, 0.5)

    // Combine redundancy sources
    return Math.min(phraseRedundancy * 0.5 + patternRedundancy, 1)
  }

  private extractPhrases(content: string, n: number): string[] {
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const phrases: string[] = []

    for (let i = 0; i <= words.length - n; i++) {
      phrases.push(words.slice(i, i + n).join(' '))
    }

    return phrases
  }

  private findRedundantPatterns(
    content: string
  ): Array<{ pattern: RegExp; description: string; matches: number }> {
    const found: Array<{ pattern: RegExp; description: string; matches: number }> = []

    for (const { pattern, description } of this.REDUNDANT_PATTERNS) {
      const matches = content.match(pattern)
      if (matches && matches.length > 0) {
        found.push({ pattern, description, matches: matches.length })
      }
    }

    return found.sort((a, b) => b.matches - a.matches)
  }

  private identifyCompressionOpportunities(
    content: string,
    redundantPatterns: Array<{ description: string; matches: number }>
  ): string[] {
    const opportunities: string[] = []

    // Top redundant patterns
    for (const { description, matches } of redundantPatterns.slice(0, 3)) {
      opportunities.push(`Remove "${description}" (${matches} instances)`)
    }

    // Check for JSON that could be simplified
    if (content.includes('```json') || content.includes('{')) {
      opportunities.push('Consider structured format instead of inline JSON')
    }

    // Check for long examples
    const exampleMatches = content.match(/example[:\s]/gi)
    if (exampleMatches && exampleMatches.length > 2) {
      opportunities.push('Consolidate multiple examples into one comprehensive case')
    }

    // Check for verbose instruction patterns
    if (content.length > 2000) {
      opportunities.push('Consider using system prompt for static instructions')
    }

    return opportunities
  }

  private calculateEfficiency(
    tokenAnalysis: TokenAnalysis,
    redundantPatterns: Array<{ matches: number }>
  ): number {
    // Base efficiency from signal-to-noise
    let efficiency = tokenAnalysis.signalToNoise

    // Penalty for redundancy
    efficiency *= (1 - tokenAnalysis.redundancy)

    // Penalty for too many redundant pattern matches
    const totalPatternMatches = redundantPatterns.reduce((sum, p) => sum + p.matches, 0)
    efficiency *= Math.max(1 - (totalPatternMatches * 0.02), 0.5)

    return Math.max(efficiency, 0.1)
  }

  private generateOptimisations(
    context: ShannonContext,
    tokenAnalysis: TokenAnalysis,
    redundantPatterns: Array<{ description: string; matches: number }>
  ): string[] {
    const recommendations: string[] = []

    // Token budget recommendations
    const budgetRatio = tokenAnalysis.totalTokens / (context.maxTokenBudget || 2000)
    if (budgetRatio > 1.5) {
      recommendations.push('CRITICAL: Prompt exceeds budget by 50%+. Aggressive compression needed.')
    } else if (budgetRatio > 1) {
      recommendations.push('Prompt exceeds budget. Remove non-essential content.')
    }

    // Signal-to-noise recommendations
    if (tokenAnalysis.signalToNoise < 0.3) {
      recommendations.push('Low information density. Replace prose with structured format.')
    }

    // Redundancy recommendations
    if (tokenAnalysis.redundancy > 0.2) {
      recommendations.push('High redundancy detected. Deduplicate repeated concepts.')
    }

    // Pattern-specific recommendations
    for (const { description, matches } of redundantPatterns.slice(0, 2)) {
      if (matches > 2) {
        recommendations.push(`Remove "${description}" (saves ~${matches * 2} tokens)`)
      }
    }

    // Model tier recommendation
    const costPerPrompt = this.estimateCost(tokenAnalysis, context.modelTier)
    if (costPerPrompt > 0.01 && context.modelTier !== 'haiku') {
      recommendations.push(`Consider downgrading to lower model tier for cost savings`)
    }

    return recommendations
  }

  private estimateCost(tokenAnalysis: TokenAnalysis, tier: ShannonContext['modelTier']): number {
    const costs = this.TOKEN_COSTS[tier]
    const inputCost = (tokenAnalysis.inputTokens / 1000000) * costs.input
    const outputCost = (tokenAnalysis.outputTokens / 1000000) * costs.output
    return inputCost + outputCost
  }

  private estimateCostSavings(
    tokenAnalysis: TokenAnalysis,
    redundantPatterns: Array<{ matches: number }>,
    _tier: ShannonContext['modelTier']
  ): number {
    // Estimate tokens that could be saved
    let potentialSavedTokens = 0

    // From redundant patterns (avg 3 tokens per match)
    for (const { matches } of redundantPatterns) {
      potentialSavedTokens += matches * 3
    }

    // From redundancy (could save ~redundancy% of input)
    potentialSavedTokens += Math.floor(tokenAnalysis.inputTokens * tokenAnalysis.redundancy * 0.5)

    // Calculate savings percentage
    if (tokenAnalysis.totalTokens === 0) return 0

    const savingsRatio = potentialSavedTokens / tokenAnalysis.totalTokens
    return Math.min(savingsRatio * 100, 50) // Cap at 50%
  }

  private generateRecommendation(
    analysis: InformationAnalysis,
    _context: ShannonContext
  ): string {
    const { efficiency, tokenBudget, actualUsage, estimatedCostSavings } = analysis

    const usagePercent = Math.round((actualUsage / tokenBudget) * 100)

    if (efficiency < 0.3) {
      return `INEFFICIENT: Only ${Math.round(efficiency * 100)}% information density. ` +
        `${estimatedCostSavings.toFixed(0)}% cost reduction possible through compression.`
    }

    if (actualUsage > tokenBudget) {
      return `OVER BUDGET: Using ${usagePercent}% of token budget. ` +
        `Reduce by ${actualUsage - tokenBudget} tokens or increase budget.`
    }

    if (efficiency > 0.7) {
      return `OPTIMAL: ${Math.round(efficiency * 100)}% efficiency at ${usagePercent}% budget. ` +
        `Minor optimisations available.`
    }

    return `ACCEPTABLE: ${Math.round(efficiency * 100)}% efficiency. ` +
      `${analysis.compressionOpportunities[0] || 'No major issues found.'}`
  }

  private generateReasoning(analysis: InformationAnalysis, context: ShannonContext): string {
    const parts: string[] = []

    parts.push(`Token efficiency: ${Math.round(analysis.efficiency * 100)}%`)
    parts.push(`Budget usage: ${analysis.actualUsage}/${analysis.tokenBudget} tokens`)
    parts.push(`Model tier: ${context.modelTier}`)
    parts.push(`Potential savings: ${analysis.estimatedCostSavings.toFixed(1)}%`)

    if (analysis.redundantPatterns.length > 0) {
      parts.push(`Redundant patterns: ${analysis.redundantPatterns.slice(0, 3).join(', ')}`)
    }

    return parts.join('. ')
  }

  private calculateConfidence(
    analysis: InformationAnalysis,
    context: ShannonContext
  ): number {
    let confidence = 0.6 // Base confidence

    // Higher confidence with actual prompt content
    if (context.promptContent.length > 100) confidence += 0.15

    // Higher confidence with clear budget
    if (context.maxTokenBudget) confidence += 0.1

    // Higher confidence with priority information
    if (context.priorityInformation && context.priorityInformation.length > 0) {
      confidence += 0.1
    }

    return Math.min(confidence, 0.9)
  }

  // Public utility methods
  compressPrompt(prompt: string): string {
    let compressed = prompt

    // Apply all redundant pattern removals
    for (const { pattern } of this.REDUNDANT_PATTERNS) {
      compressed = compressed.replace(pattern, ' ')
    }

    // Normalise whitespace
    compressed = compressed.replace(/\s+/g, ' ').trim()

    return compressed
  }

  estimateTokenCount(text: string): number {
    return this.estimateTokens(text)
  }

  getModelRecommendation(taskComplexity: 'simple' | 'moderate' | 'complex'): ShannonContext['modelTier'] {
    switch (taskComplexity) {
      case 'simple':
        return 'haiku'
      case 'moderate':
        return 'sonnet'
      case 'complex':
        return 'opus'
    }
  }
}
