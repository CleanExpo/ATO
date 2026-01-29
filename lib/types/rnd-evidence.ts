/**
 * R&D Evidence Types
 *
 * Types for collecting and scoring evidence for the Division 355 four-element test.
 * Evidence collection is critical for ATO audit defence.
 */

/**
 * Division 355 Four-Element Test elements
 */
export type EvidenceElement =
  | 'outcome_unknown'     // Evidence that outcome could not be determined in advance
  | 'systematic_approach' // Evidence of systematic progression of work
  | 'new_knowledge'       // Evidence of generating new knowledge
  | 'scientific_method'   // Evidence of using scientific principles

/**
 * Type of evidence being submitted
 */
export type EvidenceType =
  | 'document'    // Uploaded file (links to recommendation_documents)
  | 'description' // Text-based evidence description
  | 'reference'   // External URL reference

/**
 * R&D Evidence record from database
 */
export interface RndEvidence {
  id: string
  tenantId: string
  registrationId: string | null
  projectName: string
  element: EvidenceElement
  evidenceType: EvidenceType
  title: string
  description?: string
  documentId?: string    // Links to recommendation_documents table
  url?: string           // External URL reference
  dateCreated?: string   // YYYY-MM-DD when evidence was originally created
  isContemporaneous: boolean // True if created during R&D activity
  createdAt: string
  updatedAt: string
}

/**
 * Request to create a new evidence item
 */
export interface CreateRndEvidenceRequest {
  tenantId: string
  registrationId?: string
  projectName: string
  element: EvidenceElement
  evidenceType: EvidenceType
  title: string
  description?: string
  documentId?: string
  url?: string
  dateCreated?: string
  isContemporaneous?: boolean
}

/**
 * Request to update an existing evidence item
 */
export interface UpdateRndEvidenceRequest {
  title?: string
  description?: string
  documentId?: string
  url?: string
  dateCreated?: string
  isContemporaneous?: boolean
}

/**
 * R&D Evidence Score record from database
 */
export interface RndEvidenceScore {
  id: string
  tenantId: string
  registrationId: string | null
  projectName: string
  outcomeUnknownScore: number    // 0-100
  systematicApproachScore: number // 0-100
  newKnowledgeScore: number       // 0-100
  scientificMethodScore: number   // 0-100
  overallScore: number            // 0-100 weighted average
  lastCalculated: string
}

/**
 * Score level classification
 */
export type ScoreLevel = 'insufficient' | 'adequate' | 'strong'

/**
 * Score configuration for UI display
 */
export interface ScoreConfig {
  level: ScoreLevel
  label: string
  color: string
  bgColor: string
  borderColor: string
  minScore: number
  maxScore: number
}

/**
 * Score level configurations
 */
export const SCORE_LEVELS: ScoreConfig[] = [
  {
    level: 'insufficient',
    label: 'Insufficient',
    color: '#FF4444',
    bgColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
    minScore: 0,
    maxScore: 40,
  },
  {
    level: 'adequate',
    label: 'Adequate',
    color: '#FFB800',
    bgColor: 'rgba(255, 184, 0, 0.1)',
    borderColor: 'rgba(255, 184, 0, 0.3)',
    minScore: 41,
    maxScore: 70,
  },
  {
    level: 'strong',
    label: 'Strong',
    color: '#00FF88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    minScore: 71,
    maxScore: 100,
  },
]

/**
 * Element configuration for UI display
 */
export interface ElementConfig {
  id: EvidenceElement
  title: string
  shortTitle: string
  legislationRef: string
}

/**
 * Element configurations for the four-element test
 */
export const ELEMENT_CONFIG: Record<EvidenceElement, ElementConfig> = {
  outcome_unknown: {
    id: 'outcome_unknown',
    title: 'Outcome Unknown',
    shortTitle: 'Outcome',
    legislationRef: 's 355-25(1)(a) ITAA 1997',
  },
  systematic_approach: {
    id: 'systematic_approach',
    title: 'Systematic Approach',
    shortTitle: 'Systematic',
    legislationRef: 's 355-25(1)(b) ITAA 1997',
  },
  new_knowledge: {
    id: 'new_knowledge',
    title: 'New Knowledge',
    shortTitle: 'Knowledge',
    legislationRef: 's 355-25(1)(c) ITAA 1997',
  },
  scientific_method: {
    id: 'scientific_method',
    title: 'Scientific Method',
    shortTitle: 'Method',
    legislationRef: 's 355-25(1)(d) ITAA 1997',
  },
}

/**
 * Get the score level configuration for a given score
 */
export function getScoreLevel(score: number): ScoreConfig {
  if (score <= 40) {
    return SCORE_LEVELS[0] // insufficient
  } else if (score <= 70) {
    return SCORE_LEVELS[1] // adequate
  } else {
    return SCORE_LEVELS[2] // strong
  }
}

/**
 * Get element display name
 */
export function getElementDisplayName(element: EvidenceElement): string {
  return ELEMENT_CONFIG[element]?.title ?? element
}

/**
 * Evidence type display names
 */
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: 'Document Upload',
  description: 'Written Description',
  reference: 'External Reference',
}

/**
 * Evidence type icons
 */
export const EVIDENCE_TYPE_ICONS: Record<EvidenceType, string> = {
  document: '|=|',   // Document icon representation
  description: '||', // Text lines icon representation
  reference: '->'   // Link icon representation
}

/**
 * Convert database row to RndEvidence interface
 */
export function dbRowToRndEvidence(row: Record<string, unknown>): RndEvidence {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    registrationId: (row.registration_id as string) ?? null,
    projectName: row.project_name as string,
    element: row.element as EvidenceElement,
    evidenceType: row.evidence_type as EvidenceType,
    title: row.title as string,
    description: row.description as string | undefined,
    documentId: row.document_id as string | undefined,
    url: row.url as string | undefined,
    dateCreated: row.date_created as string | undefined,
    isContemporaneous: (row.is_contemporaneous as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/**
 * Convert database row to RndEvidenceScore interface
 */
export function dbRowToRndEvidenceScore(row: Record<string, unknown>): RndEvidenceScore {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    registrationId: (row.registration_id as string) ?? null,
    projectName: row.project_name as string,
    outcomeUnknownScore: (row.outcome_unknown_score as number) ?? 0,
    systematicApproachScore: (row.systematic_approach_score as number) ?? 0,
    newKnowledgeScore: (row.new_knowledge_score as number) ?? 0,
    scientificMethodScore: (row.scientific_method_score as number) ?? 0,
    overallScore: (row.overall_score as number) ?? 0,
    lastCalculated: row.last_calculated as string,
  }
}

/**
 * List of all elements in wizard order
 */
export const EVIDENCE_ELEMENTS: EvidenceElement[] = [
  'outcome_unknown',
  'systematic_approach',
  'new_knowledge',
  'scientific_method',
]

export default ELEMENT_CONFIG
