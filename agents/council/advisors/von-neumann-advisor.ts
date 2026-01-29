/**
 * von Neumann Advisor - Game Theory & Conversion
 *
 * Named after John von Neumann, father of game theory.
 * Models user decisions as strategic games, calculates Nash equilibria,
 * and optimises the conversion funnel.
 *
 * Key Principles:
 * - Users are rational actors maximising their utility
 * - Each conversion stage is a strategic decision point
 * - Incentives must outweigh friction for conversion
 * - Nash equilibrium identifies stable strategies
 */

import {
  Advisor,
  AdvisorRecommendation,
  CouncilContext,
  ConversionStage,
  ConversionStageConfig,
  GameTheoryAnalysis,
  PayoffMatrix,
  VonNeumannContext,
  CONVERSION_STAGE_ORDER
} from '../types'

export class VonNeumannAdvisor implements Advisor {
  name = 'von-neumann' as const

  // Conversion stage configurations with default probabilities
  private readonly stageConfigs: Record<ConversionStage, ConversionStageConfig> = {
    awareness: {
      stage: 'awareness',
      probability: 0.8, // Most visitors become aware
      incentives: ['clear-value-prop', 'social-proof', 'trust-signals'],
      friction: ['complex-ui', 'slow-load', 'unclear-messaging'],
      nextStageThreshold: 0.6
    },
    interest: {
      stage: 'interest',
      probability: 0.5,
      incentives: ['demo-access', 'case-studies', 'feature-highlights'],
      friction: ['registration-required', 'pricing-hidden', 'too-many-steps'],
      nextStageThreshold: 0.4
    },
    decision: {
      stage: 'decision',
      probability: 0.3,
      incentives: ['free-trial', 'money-back-guarantee', 'comparison-tools'],
      friction: ['contract-terms', 'setup-complexity', 'competitor-alternatives'],
      nextStageThreshold: 0.25
    },
    action: {
      stage: 'action',
      probability: 0.15,
      incentives: ['onboarding-assistance', 'quick-wins', 'progress-tracking'],
      friction: ['payment-friction', 'data-migration', 'time-investment'],
      nextStageThreshold: 0.1
    },
    retention: {
      stage: 'retention',
      probability: 0.7, // Of those who act, most retain
      incentives: ['ongoing-value', 'support-quality', 'feature-releases'],
      friction: ['switching-costs', 'value-decay', 'competitor-poaching'],
      nextStageThreshold: 0.5
    }
  }

  async analyse(context: CouncilContext): Promise<AdvisorRecommendation> {
    const vnContext = context.vonNeumann || this.inferContext(context)
    const analysis = await this.performAnalysis(vnContext)

    return {
      advisor: this.name,
      recommendation: this.generateRecommendation(analysis),
      confidence: this.calculateConfidence(analysis, vnContext),
      reasoning: this.generateReasoning(analysis),
      metrics: {
        conversionProbability: analysis.stageProbability,
        expectedValue: analysis.expectedValue,
        riskScore: this.riskToScore(analysis.riskAssessment),
        stageIndex: CONVERSION_STAGE_ORDER.indexOf(analysis.currentStage)
      },
      timestamp: new Date()
    }
  }

  private inferContext(context: CouncilContext): VonNeumannContext {
    return {
      userId: context.userId || 'anonymous',
      organisationId: context.organisationId,
      currentStage: this.inferStageFromType(context.type),
      actionHistory: [],
      sessionDuration: undefined,
      pageViews: undefined,
      featureInteractions: []
    }
  }

  private inferStageFromType(type: CouncilContext['type']): ConversionStage {
    switch (type) {
      case 'user-action':
        return 'interest'
      case 'analysis-request':
        return 'decision'
      case 'report-generation':
        return 'action'
      case 'data-sync':
        return 'action'
      default:
        return 'awareness'
    }
  }

  private async performAnalysis(context: VonNeumannContext): Promise<GameTheoryAnalysis> {
    const stageConfig = this.stageConfigs[context.currentStage]
    const payoffMatrix = this.buildPayoffMatrix(context)
    const nashEquilibrium = this.findNashEquilibrium(payoffMatrix)
    const stageProbability = this.calculateStageProbability(context, stageConfig)
    const recommendedAction = this.determineOptimalAction(payoffMatrix, nashEquilibrium)
    const expectedValue = this.calculateExpectedValue(stageProbability, context)
    const riskAssessment = this.assessRisk(stageProbability, context)

    return {
      currentStage: context.currentStage,
      stageProbability,
      payoffMatrix,
      nashEquilibrium,
      dominantStrategy: this.findDominantStrategy(payoffMatrix),
      recommendedAction,
      expectedValue,
      riskAssessment
    }
  }

  private buildPayoffMatrix(context: VonNeumannContext): PayoffMatrix {
    const stage = context.currentStage
    const stageConfig = this.stageConfigs[stage]

    // Actions available at this stage
    const actions = this.getStageActions(stage)

    // Build payoff matrix based on user-system game
    // Rows: User actions, Columns: System responses
    const outcomes: number[][] = actions.map(action => {
      return [
        this.calculatePayoff(action, 'incentivise', context, stageConfig),
        this.calculatePayoff(action, 'neutral', context, stageConfig),
        this.calculatePayoff(action, 'friction', context, stageConfig)
      ]
    })

    return {
      actions,
      outcomes,
      description: `${stage} stage payoff matrix for conversion optimisation`
    }
  }

  private getStageActions(stage: ConversionStage): string[] {
    switch (stage) {
      case 'awareness':
        return ['explore', 'ignore', 'bounce']
      case 'interest':
        return ['signup', 'bookmark', 'compare']
      case 'decision':
        return ['start-trial', 'request-demo', 'defer']
      case 'action':
        return ['complete-setup', 'partial-setup', 'abandon']
      case 'retention':
        return ['renew', 'expand', 'churn']
    }
  }

  private calculatePayoff(
    userAction: string,
    systemResponse: 'incentivise' | 'neutral' | 'friction',
    context: VonNeumannContext,
    _stageConfig: ConversionStageConfig
  ): number {
    // Base payoff from action type
    let payoff = this.getBasePayoff(userAction)

    // System response modifier
    const responseModifiers = {
      incentivise: 1.5,
      neutral: 1.0,
      friction: 0.5
    }
    payoff *= responseModifiers[systemResponse]

    // Historical behaviour modifier
    if (context.actionHistory.length > 0) {
      const engagementScore = context.actionHistory.length / 10
      payoff *= (1 + Math.min(engagementScore, 0.5))
    }

    // Session duration bonus
    if (context.sessionDuration && context.sessionDuration > 60) {
      payoff *= 1.2
    }

    return Math.round(payoff * 100) / 100
  }

  private getBasePayoff(action: string): number {
    const payoffs: Record<string, number> = {
      // Positive actions
      'explore': 2,
      'signup': 8,
      'start-trial': 10,
      'complete-setup': 15,
      'renew': 12,
      'expand': 20,
      'request-demo': 7,

      // Neutral actions
      'bookmark': 3,
      'compare': 4,
      'partial-setup': 5,
      'defer': 1,

      // Negative actions
      'ignore': -1,
      'bounce': -5,
      'abandon': -8,
      'churn': -15
    }

    return payoffs[action] || 0
  }

  private findNashEquilibrium(matrix: PayoffMatrix): string | undefined {
    // Simplified Nash equilibrium finding for 2-player zero-sum approximation
    // Find the action that maximises minimum payoff (maximin strategy)
    let maxMinPayoff = -Infinity
    let equilibriumAction: string | undefined

    for (let i = 0; i < matrix.actions.length; i++) {
      const minPayoff = Math.min(...matrix.outcomes[i])
      if (minPayoff > maxMinPayoff) {
        maxMinPayoff = minPayoff
        equilibriumAction = matrix.actions[i]
      }
    }

    return equilibriumAction
  }

  private findDominantStrategy(matrix: PayoffMatrix): string | undefined {
    // Find a strategy that is always better than alternatives
    for (let i = 0; i < matrix.actions.length; i++) {
      let isDominant = true

      for (let j = 0; j < matrix.actions.length; j++) {
        if (i === j) continue

        // Check if action i dominates action j in all scenarios
        for (let k = 0; k < matrix.outcomes[i].length; k++) {
          if (matrix.outcomes[i][k] <= matrix.outcomes[j][k]) {
            isDominant = false
            break
          }
        }

        if (!isDominant) break
      }

      if (isDominant) {
        return matrix.actions[i]
      }
    }

    return undefined
  }

  private calculateStageProbability(
    context: VonNeumannContext,
    stageConfig: ConversionStageConfig
  ): number {
    let probability = stageConfig.probability

    // Adjust based on engagement signals
    if (context.pageViews && context.pageViews > 5) {
      probability *= 1.2
    }

    if (context.featureInteractions && context.featureInteractions.length > 3) {
      probability *= 1.3
    }

    if (context.sessionDuration) {
      if (context.sessionDuration > 120) probability *= 1.4
      else if (context.sessionDuration > 60) probability *= 1.2
    }

    // Decay based on funnel position
    const stageIndex = CONVERSION_STAGE_ORDER.indexOf(context.currentStage)
    probability *= Math.pow(0.9, stageIndex)

    return Math.min(probability, 0.95)
  }

  private determineOptimalAction(
    matrix: PayoffMatrix,
    nashEquilibrium: string | undefined
  ): string {
    // Prefer Nash equilibrium if found
    if (nashEquilibrium) {
      return `Incentivise ${nashEquilibrium} - this is the Nash equilibrium`
    }

    // Otherwise, find maximum expected payoff action
    let maxExpected = -Infinity
    let optimalAction = matrix.actions[0]

    for (let i = 0; i < matrix.actions.length; i++) {
      const expected = matrix.outcomes[i].reduce((a, b) => a + b, 0) / matrix.outcomes[i].length
      if (expected > maxExpected) {
        maxExpected = expected
        optimalAction = matrix.actions[i]
      }
    }

    return `Incentivise ${optimalAction} - highest expected payoff`
  }

  private calculateExpectedValue(probability: number, context: VonNeumannContext): number {
    // Customer Lifetime Value calculation
    const baseClv = 5000 // $5000 base CLV for tax software
    const stageMultipliers: Record<ConversionStage, number> = {
      awareness: 0.1,
      interest: 0.25,
      decision: 0.5,
      action: 0.8,
      retention: 1.2
    }

    const multiplier = stageMultipliers[context.currentStage]
    return Math.round(baseClv * probability * multiplier)
  }

  private assessRisk(probability: number, _context: VonNeumannContext): 'low' | 'medium' | 'high' {
    // Risk of losing the user
    if (probability > 0.6) return 'low'
    if (probability > 0.3) return 'medium'
    return 'high'
  }

  private generateRecommendation(analysis: GameTheoryAnalysis): string {
    const { currentStage, stageProbability, recommendedAction, riskAssessment } = analysis

    if (riskAssessment === 'high') {
      return `HIGH RISK at ${currentStage} stage (${(stageProbability * 100).toFixed(0)}% conversion). ${recommendedAction}. Deploy retention incentives immediately.`
    }

    if (riskAssessment === 'medium') {
      return `OPPORTUNITY at ${currentStage} stage (${(stageProbability * 100).toFixed(0)}% conversion). ${recommendedAction}. Reduce friction points.`
    }

    return `HEALTHY ${currentStage} stage (${(stageProbability * 100).toFixed(0)}% conversion). ${recommendedAction}. Maintain current trajectory.`
  }

  private generateReasoning(analysis: GameTheoryAnalysis): string {
    const parts: string[] = []

    parts.push(`Current stage: ${analysis.currentStage}`)
    parts.push(`Conversion probability: ${(analysis.stageProbability * 100).toFixed(1)}%`)
    parts.push(`Expected value: $${analysis.expectedValue}`)
    parts.push(`Risk level: ${analysis.riskAssessment}`)

    if (analysis.nashEquilibrium) {
      parts.push(`Nash equilibrium: ${analysis.nashEquilibrium}`)
    }

    if (analysis.dominantStrategy) {
      parts.push(`Dominant strategy: ${analysis.dominantStrategy}`)
    }

    return parts.join('. ')
  }

  private calculateConfidence(
    analysis: GameTheoryAnalysis,
    context: VonNeumannContext
  ): number {
    let confidence = 0.5 // Base confidence

    // More data = higher confidence
    if (context.actionHistory.length > 0) confidence += 0.1
    if (context.sessionDuration) confidence += 0.1
    if (context.pageViews) confidence += 0.1
    if (context.featureInteractions && context.featureInteractions.length > 0) confidence += 0.1

    // Nash equilibrium found = higher confidence
    if (analysis.nashEquilibrium) confidence += 0.1

    return Math.min(confidence, 0.9)
  }

  private riskToScore(risk: 'low' | 'medium' | 'high'): number {
    const scores = { low: 90, medium: 50, high: 20 }
    return scores[risk]
  }

  // Public method for conversion tracking
  async trackConversion(
    context: VonNeumannContext,
    action: string,
    _value?: number
  ): Promise<{ success: boolean; nextStage?: ConversionStage }> {
    const currentIndex = CONVERSION_STAGE_ORDER.indexOf(context.currentStage)
    const isPositiveAction = this.getBasePayoff(action) > 0

    if (isPositiveAction && currentIndex < CONVERSION_STAGE_ORDER.length - 1) {
      return {
        success: true,
        nextStage: CONVERSION_STAGE_ORDER[currentIndex + 1]
      }
    }

    return { success: isPositiveAction }
  }
}
