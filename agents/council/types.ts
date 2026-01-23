/**
 * Council of Logic - Type Definitions
 *
 * Mathematical first principles for meta-orchestration:
 * - Alan Turing: Algorithmic Efficiency
 * - John von Neumann: Game Theory & Conversion
 * - Pierre Bezier: Animation Physics
 * - Claude Shannon: Information Theory
 */

// =============================================================================
// ADVISOR TYPES
// =============================================================================

export type AdvisorName = 'turing' | 'von-neumann' | 'bezier' | 'shannon'

export interface AdvisorRecommendation {
  advisor: AdvisorName
  recommendation: string
  confidence: number // 0-1
  reasoning: string
  metrics?: Record<string, number>
  timestamp: Date
}

export interface Advisor {
  name: AdvisorName
  analyse(context: CouncilContext): Promise<AdvisorRecommendation>
}

// =============================================================================
// TURING ADVISOR - ALGORITHMIC EFFICIENCY
// =============================================================================

export type ComplexityClass = 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(2^n)'

export interface AlgorithmicAnalysis {
  timeComplexity: ComplexityClass
  spaceComplexity: ComplexityClass
  optimisationPotential: number // 0-1, how much room for improvement
  bottlenecks: string[]
  recommendations: string[]
  queryCount?: number
  cacheHitRate?: number
}

export interface TuringContext {
  operation: string
  dataSize: number
  queryPatterns?: string[]
  executionTime?: number
  memoryUsage?: number
}

// =============================================================================
// VON NEUMANN ADVISOR - GAME THEORY & CONVERSION
// =============================================================================

export type ConversionStage = 'awareness' | 'interest' | 'decision' | 'action' | 'retention'

export interface PayoffMatrix {
  actions: string[]
  outcomes: number[][]
  description: string
}

export interface ConversionStageConfig {
  stage: ConversionStage
  probability: number // Current conversion probability
  incentives: string[] // Available incentives
  friction: string[] // Current friction points
  nextStageThreshold: number
}

export interface GameTheoryAnalysis {
  currentStage: ConversionStage
  stageProbability: number
  payoffMatrix: PayoffMatrix
  nashEquilibrium?: string
  dominantStrategy?: string
  recommendedAction: string
  expectedValue: number
  riskAssessment: 'low' | 'medium' | 'high'
}

export interface VonNeumannContext {
  userId: string
  organisationId: string
  currentStage: ConversionStage
  actionHistory: string[]
  sessionDuration?: number
  pageViews?: number
  featureInteractions?: string[]
}

export interface ConversionEvent {
  id?: string
  organisationId: string
  userId: string
  stage: ConversionStage
  action: string
  value?: number
  metadata: Record<string, unknown>
  createdAt?: Date
}

// =============================================================================
// BEZIER ADVISOR - ANIMATION PHYSICS
// =============================================================================

export type EasingType = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'

export interface CubicBezier {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface SpringConfig {
  damping: number
  stiffness: number
  mass: number
  velocity?: number
}

export interface AnimationConfig {
  type: EasingType
  duration: number // milliseconds
  bezier?: CubicBezier
  spring?: SpringConfig
}

export interface AnimationAnalysis {
  recommendedConfig: AnimationConfig
  physicsValidation: boolean
  performanceImpact: 'minimal' | 'moderate' | 'significant'
  fps60Compatible: boolean
  reasoning: string
  warnings: string[]
}

export interface BezierContext {
  animationType: 'entry' | 'exit' | 'transition' | 'micro-interaction'
  elementType: 'card' | 'button' | 'modal' | 'list-item' | 'progress' | 'toast'
  currentConfig?: AnimationConfig
  targetDistance?: number // pixels
  urgency: 'low' | 'medium' | 'high'
}

// =============================================================================
// SHANNON ADVISOR - INFORMATION THEORY
// =============================================================================

export interface TokenAnalysis {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  compressionRatio: number // outputTokens / inputTokens
  signalToNoise: number // 0-1, proportion of useful content
  redundancy: number // 0-1, proportion of repetitive content
  efficiency: number // Overall efficiency score 0-1
}

export interface InformationAnalysis {
  tokenBudget: number
  actualUsage: number
  efficiency: number
  compressionOpportunities: string[]
  redundantPatterns: string[]
  recommendations: string[]
  estimatedCostSavings: number // percentage
}

export interface ShannonContext {
  promptContent: string
  expectedResponseSize: 'small' | 'medium' | 'large'
  modelTier: 'haiku' | 'sonnet' | 'opus'
  maxTokenBudget?: number
  priorityInformation?: string[]
}

// =============================================================================
// COUNCIL SESSION
// =============================================================================

export type CouncilDecisionType =
  | 'monitoring-cycle'
  | 'user-action'
  | 'data-sync'
  | 'analysis-request'
  | 'report-generation'
  | 'animation-optimisation'
  | 'prompt-optimisation'

export interface CouncilContext {
  type: CouncilDecisionType
  organisationId: string
  userId?: string
  turing?: TuringContext
  vonNeumann?: VonNeumannContext
  bezier?: BezierContext
  shannon?: ShannonContext
  metadata?: Record<string, unknown>
}

export interface CouncilDecision {
  id: string
  context: CouncilContext
  advisorRecommendations: AdvisorRecommendation[]
  finalDecision: string
  confidence: number // Weighted average of advisor confidences
  reasoning: string
  executionPlan?: string[]
  estimatedDuration?: number
}

export interface CouncilSession {
  id: string
  organisationId: string
  userId?: string
  context: CouncilContext
  advisorRecommendations: AdvisorRecommendation[]
  finalDecision: string
  confidence: number
  startedAt: Date
  completedAt?: Date
  executionResult?: unknown
}

// =============================================================================
// COUNCIL METRICS
// =============================================================================

export interface AdvisorMetrics {
  advisor: AdvisorName
  totalRecommendations: number
  averageConfidence: number
  accuracyRate: number // How often recommendations were followed
  impactScore: number // Measured improvement from following advice
}

export interface ConversionMetrics {
  stage: ConversionStage
  enterCount: number
  exitCount: number
  conversionRate: number
  averageTimeInStage: number // seconds
  topFrictionPoints: string[]
  topIncentives: string[]
}

export interface CouncilMetrics {
  organisationId: string
  period: { start: Date; end: Date }
  totalSessions: number
  averageConfidence: number
  advisorMetrics: AdvisorMetrics[]
  conversionMetrics: ConversionMetrics[]
  performanceGains: {
    algorithmicEfficiency: number // percentage improvement
    conversionRate: number
    animationPerformance: number
    tokenEfficiency: number
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const ADVISOR_WEIGHTS: Record<AdvisorName, number> = {
  'turing': 0.30,      // Algorithmic efficiency is critical
  'von-neumann': 0.35, // Conversion is business priority
  'bezier': 0.15,      // UX polish
  'shannon': 0.20      // Cost optimisation
}

export const CONVERSION_STAGE_ORDER: ConversionStage[] = [
  'awareness',
  'interest',
  'decision',
  'action',
  'retention'
]

export const DEFAULT_ANIMATION_CONFIGS: Record<string, AnimationConfig> = {
  'entry-gentle': {
    type: 'spring',
    duration: 400,
    spring: { damping: 20, stiffness: 100, mass: 1 }
  },
  'entry-snappy': {
    type: 'spring',
    duration: 300,
    spring: { damping: 25, stiffness: 300, mass: 1 }
  },
  'exit-fast': {
    type: 'ease-out',
    duration: 200,
    bezier: { x1: 0, y1: 0, x2: 0.2, y2: 1 }
  },
  'micro-interaction': {
    type: 'ease-in-out',
    duration: 150,
    bezier: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 }
  }
}

export const COMPLEXITY_THRESHOLDS = {
  acceptable: 'O(n log n)',
  warning: 'O(n²)',
  critical: 'O(2^n)'
}
