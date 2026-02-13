/**
 * Council of Logic
 *
 * Meta-orchestration system with 4 mathematical advisors
 * for optimising agent execution and user conversion.
 *
 * Advisors:
 * - Alan Turing: Algorithmic efficiency (O notation, bottlenecks)
 * - John von Neumann: Game theory (conversion funnels, Nash equilibria)
 * - Pierre Bezier: Animation physics (spring configs, 60fps)
 * - Claude Shannon: Information theory (token economy, compression)
 */

// Main orchestrator
export { CouncilOfLogicOrchestrator } from './council-orchestrator'

// Individual advisors
export { TuringAdvisor } from './advisors/turing-advisor'
export { VonNeumannAdvisor } from './advisors/von-neumann-advisor'
export { BezierAdvisor } from './advisors/bezier-advisor'
export { ShannonAdvisor } from './advisors/shannon-advisor'

// Types
export type {
  // Advisor types
  Advisor,
  AdvisorName,
  AdvisorRecommendation,

  // Turing types
  AlgorithmicAnalysis,
  ComplexityClass,
  TuringContext,

  // von Neumann types
  ConversionStage,
  ConversionStageConfig,
  ConversionEvent,
  GameTheoryAnalysis,
  PayoffMatrix,
  VonNeumannContext,

  // Bezier types
  AnimationAnalysis,
  AnimationConfig,
  BezierContext,
  CubicBezier,
  EasingType,
  SpringConfig,

  // Shannon types
  InformationAnalysis,
  ShannonContext,
  TokenAnalysis,

  // Council types
  CouncilContext,
  CouncilDecision,
  CouncilDecisionType,
  CouncilMetrics,
  CouncilSession,
  AdvisorMetrics,
  ConversionMetrics
} from './types'

// Constants
export {
  ADVISOR_WEIGHTS,
  CONVERSION_STAGE_ORDER,
  DEFAULT_ANIMATION_CONFIGS,
  COMPLEXITY_THRESHOLDS
} from './types'
