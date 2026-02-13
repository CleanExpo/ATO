/**
 * Bezier Advisor - Animation Physics
 *
 * Named after Pierre Bezier, creator of Bezier curves.
 * Validates animation configurations, ensures 60fps performance,
 * and recommends physics-based motion for natural feel.
 *
 * Key Principles:
 * - 60fps = 16.67ms per frame budget
 * - Spring animations feel more natural than linear
 * - Duration should match user expectation (feedback < 150ms)
 * - Overshoot creates perceived speed without actual speed
 */

import {
  Advisor,
  AdvisorRecommendation,
  AnimationAnalysis,
  AnimationConfig,
  BezierContext,
  CouncilContext,
  CubicBezier,
  SpringConfig
} from '../types'

export class BezierAdvisor implements Advisor {
  name = 'bezier' as const

  // Common easing presets
  private readonly EASING_PRESETS: Record<string, CubicBezier> = {
    // Standard CSS easings
    'ease': { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
    'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
    'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
    'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },

    // Material Design
    'material-standard': { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
    'material-decelerate': { x1: 0, y1: 0, x2: 0.2, y2: 1 },
    'material-accelerate': { x1: 0.4, y1: 0, x2: 1, y2: 1 },

    // Framer Motion inspired
    'anticipate': { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
    'overshoot': { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }
  }

  // Spring presets by feel
  private readonly SPRING_PRESETS: Record<string, SpringConfig> = {
    'gentle': { damping: 20, stiffness: 100, mass: 1 },
    'snappy': { damping: 25, stiffness: 300, mass: 1 },
    'bouncy': { damping: 15, stiffness: 200, mass: 1 },
    'stiff': { damping: 30, stiffness: 400, mass: 1 },
    'molasses': { damping: 40, stiffness: 50, mass: 2 }
  }

  // Duration guidelines by animation type (in ms)
  private readonly DURATION_GUIDELINES = {
    'micro-interaction': { min: 100, max: 200, optimal: 150 },
    'entry': { min: 200, max: 500, optimal: 300 },
    'exit': { min: 150, max: 300, optimal: 200 },
    'transition': { min: 200, max: 400, optimal: 300 }
  }

  async analyse(context: CouncilContext): Promise<AdvisorRecommendation> {
    const bezierContext = context.bezier || this.inferContext(context)
    const analysis = await this.performAnalysis(bezierContext)

    return {
      advisor: this.name,
      recommendation: this.generateRecommendation(analysis, bezierContext),
      confidence: this.calculateConfidence(analysis, bezierContext),
      reasoning: this.generateReasoning(analysis),
      metrics: {
        fps60Compatible: analysis.fps60Compatible ? 1 : 0,
        performanceScore: this.performanceImpactToScore(analysis.performanceImpact),
        physicsValid: analysis.physicsValidation ? 1 : 0,
        recommendedDuration: analysis.recommendedConfig.duration
      },
      timestamp: new Date()
    }
  }

  private inferContext(context: CouncilContext): BezierContext {
    // Infer animation context from operation type
    let animationType: BezierContext['animationType'] = 'transition'
    let elementType: BezierContext['elementType'] = 'card'
    let urgency: BezierContext['urgency'] = 'medium'

    switch (context.type) {
      case 'monitoring-cycle':
        animationType = 'micro-interaction'
        elementType = 'progress'
        urgency = 'low'
        break
      case 'report-generation':
        animationType = 'entry'
        elementType = 'modal'
        urgency = 'medium'
        break
      case 'user-action':
        animationType = 'micro-interaction'
        elementType = 'button'
        urgency = 'high'
        break
      case 'analysis-request':
        animationType = 'transition'
        elementType = 'card'
        urgency = 'medium'
        break
    }

    return {
      animationType,
      elementType,
      urgency,
      currentConfig: undefined,
      targetDistance: undefined
    }
  }

  private async performAnalysis(context: BezierContext): Promise<AnimationAnalysis> {
    const recommendedConfig = this.recommendConfig(context)
    const physicsValidation = this.validatePhysics(recommendedConfig, context)
    const performanceImpact = this.assessPerformanceImpact(recommendedConfig, context)
    const fps60Compatible = this.check60FpsCompatibility(recommendedConfig)
    const warnings = this.generateWarnings(context, recommendedConfig)

    return {
      recommendedConfig,
      physicsValidation,
      performanceImpact,
      fps60Compatible,
      reasoning: this.explainPhysics(recommendedConfig, context),
      warnings
    }
  }

  private recommendConfig(context: BezierContext): AnimationConfig {
    const { animationType, elementType, urgency, targetDistance } = context
    const guidelines = this.DURATION_GUIDELINES[animationType]

    // Determine base duration
    let duration = guidelines.optimal

    // Adjust duration based on urgency
    if (urgency === 'high') {
      duration = guidelines.min
    } else if (urgency === 'low') {
      duration = guidelines.max
    }

    // Adjust duration based on distance (if provided)
    if (targetDistance) {
      // Longer distances need longer durations for natural feel
      // Rule: ~100px per 100ms baseline
      const distanceDuration = Math.max(duration, (targetDistance / 100) * 100)
      duration = Math.min(distanceDuration, guidelines.max * 1.5)
    }

    // Select animation type based on element
    if (this.shouldUseSpring(elementType, animationType)) {
      return this.createSpringConfig(context, duration)
    }

    return this.createBezierConfig(context, duration)
  }

  private shouldUseSpring(
    elementType: BezierContext['elementType'],
    animationType: BezierContext['animationType']
  ): boolean {
    // Springs work best for these scenarios
    const springElements = ['card', 'modal', 'toast', 'list-item']
    const springAnimations = ['entry', 'transition']

    return springElements.includes(elementType) && springAnimations.includes(animationType)
  }

  private createSpringConfig(context: BezierContext, baseDuration: number): AnimationConfig {
    const { animationType, urgency } = context

    // Select spring preset based on feel
    let springPreset = 'gentle'

    if (urgency === 'high' || animationType === 'micro-interaction') {
      springPreset = 'snappy'
    } else if (animationType === 'entry') {
      springPreset = 'bouncy'
    }

    return {
      type: 'spring',
      duration: baseDuration, // Spring duration is approximate
      spring: { ...this.SPRING_PRESETS[springPreset] }
    }
  }

  private createBezierConfig(context: BezierContext, duration: number): AnimationConfig {
    const { animationType, urgency } = context

    // Select bezier curve based on animation type
    let curvePreset = 'ease'

    switch (animationType) {
      case 'entry':
        curvePreset = urgency === 'high' ? 'material-decelerate' : 'ease-out'
        break
      case 'exit':
        curvePreset = urgency === 'high' ? 'material-accelerate' : 'ease-in'
        break
      case 'micro-interaction':
        curvePreset = 'ease-in-out'
        break
      case 'transition':
        curvePreset = 'material-standard'
        break
    }

    const bezier = this.EASING_PRESETS[curvePreset]

    return {
      type: curvePreset.includes('ease') ? 'ease-in-out' as const : 'ease' as const,
      duration,
      bezier
    }
  }

  private validatePhysics(config: AnimationConfig, _context: BezierContext): boolean {
    // Validate spring physics if applicable
    if (config.spring) {
      const { damping, stiffness, mass } = config.spring

      // Critical damping ratio: ζ = c / (2 * sqrt(k * m))
      // Where c = damping, k = stiffness, m = mass
      const criticalDamping = 2 * Math.sqrt(stiffness * mass)
      const dampingRatio = damping / criticalDamping

      // Underdamped (0 < ζ < 1): oscillates and settles
      // Critically damped (ζ = 1): fastest settle without oscillation
      // Overdamped (ζ > 1): slow settle without oscillation

      // For UI, we want underdamped to slightly overdamped
      if (dampingRatio < 0.2) {
        return false // Too bouncy, feels broken
      }
      if (dampingRatio > 2) {
        return false // Too sluggish, feels slow
      }

      return true
    }

    // Validate bezier curve
    if (config.bezier) {
      const { x1, y1, x2, y2 } = config.bezier

      // Control points must be in valid range
      // X values must be 0-1, Y values can be outside for overshoot
      if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
        return false
      }

      // Y values outside -2 to 2 create jarring motion
      if (y1 < -2 || y1 > 2 || y2 < -2 || y2 > 2) {
        return false
      }

      return true
    }

    // Duration validation
    if (config.duration < 50) {
      return false // Too fast to perceive
    }
    if (config.duration > 2000) {
      return false // Too slow, feels broken
    }

    return true
  }

  private check60FpsCompatibility(config: AnimationConfig): boolean {
    // 60fps = 16.67ms per frame
    // Animation should not require complex calculations per frame

    if (config.spring) {
      const { stiffness, mass } = config.spring

      // Very high stiffness can cause numerical instability
      if (stiffness > 1000) return false

      // Very low mass can cause fast oscillations
      if (mass < 0.1) return false
    }

    // Duration under 50ms can cause frame skipping perception
    if (config.duration < 50) return false

    return true
  }

  private assessPerformanceImpact(
    config: AnimationConfig,
    context: BezierContext
  ): 'minimal' | 'moderate' | 'significant' {
    let impactScore = 0

    // Spring animations are more CPU intensive
    if (config.spring) {
      impactScore += 2
    }

    // Long durations mean more frames
    if (config.duration > 500) {
      impactScore += 1
    }

    // Large elements have more pixels to animate
    const largeElements = ['modal', 'card']
    if (largeElements.includes(context.elementType)) {
      impactScore += 1
    }

    // Multiple simultaneous animations
    if (context.animationType === 'entry') {
      impactScore += 1 // Often paired with other elements
    }

    if (impactScore <= 2) return 'minimal'
    if (impactScore <= 4) return 'moderate'
    return 'significant'
  }

  private generateWarnings(context: BezierContext, config: AnimationConfig): string[] {
    const warnings: string[] = []

    // Check current config issues
    if (context.currentConfig) {
      if (context.currentConfig.duration > 500 && context.urgency === 'high') {
        warnings.push('Current animation too slow for high-urgency interaction')
      }

      if (context.currentConfig.type === 'linear') {
        warnings.push('Linear easing feels mechanical - consider ease-out')
      }
    }

    // Check recommended config caveats
    if (config.spring && config.spring.damping < 15) {
      warnings.push('Low damping may cause excessive bounce on some devices')
    }

    if (config.duration < 100 && context.animationType !== 'micro-interaction') {
      warnings.push('Very short duration may not register with users')
    }

    // Performance warnings
    if (context.elementType === 'modal' && config.duration > 400) {
      warnings.push('Long modal animations can frustrate users')
    }

    return warnings
  }

  private explainPhysics(config: AnimationConfig, context: BezierContext): string {
    const parts: string[] = []

    if (config.spring) {
      const { damping, stiffness, mass } = config.spring
      const criticalDamping = 2 * Math.sqrt(stiffness * mass)
      const dampingRatio = damping / criticalDamping

      if (dampingRatio < 1) {
        parts.push(`Underdamped spring (ζ=${dampingRatio.toFixed(2)}) creates natural bounce`)
      } else if (dampingRatio === 1) {
        parts.push('Critically damped - fastest settle without overshoot')
      } else {
        parts.push(`Overdamped (ζ=${dampingRatio.toFixed(2)}) for smooth, controlled motion`)
      }
    }

    if (config.bezier) {
      const { y1, y2 } = config.bezier
      if (y1 > 1 || y2 > 1) {
        parts.push('Overshoot curve creates perceived speed')
      }
      if (y1 < 0 || y2 < 0) {
        parts.push('Anticipation curve builds expectation')
      }
    }

    parts.push(`${config.duration}ms duration matches ${context.animationType} expectations`)

    return parts.join('. ')
  }

  private generateRecommendation(analysis: AnimationAnalysis, context: BezierContext): string {
    const { recommendedConfig, performanceImpact, warnings } = analysis

    const configSummary = recommendedConfig.spring
      ? `spring(damping: ${recommendedConfig.spring.damping}, stiffness: ${recommendedConfig.spring.stiffness})`
      : `${recommendedConfig.type} ${recommendedConfig.duration}ms`

    if (warnings.length > 0) {
      return `OPTIMISE: Use ${configSummary} for ${context.elementType}. Warning: ${warnings[0]}`
    }

    if (performanceImpact === 'significant') {
      return `CAUTION: ${configSummary} has significant performance impact. Consider simplifying for low-end devices.`
    }

    return `RECOMMENDED: ${configSummary} for ${context.animationType} ${context.elementType}. Performance impact: ${performanceImpact}.`
  }

  private generateReasoning(analysis: AnimationAnalysis): string {
    const parts: string[] = []

    parts.push(`Physics valid: ${analysis.physicsValidation ? 'Yes' : 'No'}`)
    parts.push(`60fps compatible: ${analysis.fps60Compatible ? 'Yes' : 'No'}`)
    parts.push(`Performance: ${analysis.performanceImpact}`)
    parts.push(analysis.reasoning)

    if (analysis.warnings.length > 0) {
      parts.push(`Warnings: ${analysis.warnings.join(', ')}`)
    }

    return parts.join('. ')
  }

  private calculateConfidence(analysis: AnimationAnalysis, context: BezierContext): number {
    let confidence = 0.7 // Base confidence

    // Higher confidence with current config to compare
    if (context.currentConfig) confidence += 0.1

    // Higher confidence if physics validates
    if (analysis.physicsValidation) confidence += 0.1

    // Lower confidence with significant performance impact
    if (analysis.performanceImpact === 'significant') confidence -= 0.1

    // Lower confidence with warnings
    confidence -= analysis.warnings.length * 0.05

    return Math.min(Math.max(confidence, 0.4), 0.95)
  }

  private performanceImpactToScore(impact: 'minimal' | 'moderate' | 'significant'): number {
    const scores = { minimal: 100, moderate: 70, significant: 40 }
    return scores[impact]
  }

  // Public utility methods
  getCubicBezierCSS(bezier: CubicBezier): string {
    return `cubic-bezier(${bezier.x1}, ${bezier.y1}, ${bezier.x2}, ${bezier.y2})`
  }

  getSpringDuration(spring: SpringConfig): number {
    // Approximate spring settling time
    // Based on damping ratio and natural frequency
    const { damping, stiffness, mass } = spring
    const omega = Math.sqrt(stiffness / mass) // Natural frequency
    const zeta = damping / (2 * Math.sqrt(stiffness * mass)) // Damping ratio

    // Time to reach 2% of final value (settling time)
    // For underdamped: ts ≈ 4 / (ζ * ωn)
    // For overdamped: ts ≈ (2 * ζ) / ωn
    if (zeta < 1) {
      return Math.ceil((4 / (zeta * omega)) * 1000)
    } else {
      return Math.ceil(((2 * zeta) / omega) * 1000)
    }
  }
}
