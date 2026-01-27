/**
 * R&D Claim Preparation Checklist Types
 *
 * Types for tracking claim preparation progress across documentation,
 * registration, tax return, and post-submission categories.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive
 */

/**
 * Checklist category groupings
 */
export type ChecklistCategory =
  | 'documentation'     // Evidence and documentation requirements
  | 'registration'      // AusIndustry registration steps
  | 'tax_return'        // Tax return and Schedule 16N
  | 'post_submission'   // Post-submission record keeping

/**
 * Checklist filter options for UI
 */
export type ChecklistFilter = 'all' | 'incomplete' | 'completed'

/**
 * Checklist template - read-only reference data for standard items
 */
export interface ChecklistTemplate {
  id: string
  category: ChecklistCategory
  itemKey: string
  title: string
  description?: string
  legislationReference?: string
  isMandatory: boolean
  displayOrder: number
  helpUrl?: string
}

/**
 * Checklist item - tenant-specific completion tracking
 */
export interface ChecklistItem {
  id: string
  tenantId: string
  registrationId: string | null
  category: ChecklistCategory
  itemKey: string
  isCompleted: boolean
  completedAt?: string
  completedBy?: string
  notes?: string
  documentId?: string
  createdAt: string
}

/**
 * Merged checklist item: template + completion status
 * Used for display in the UI
 */
export interface ChecklistItemWithStatus extends ChecklistTemplate {
  /** True if a completion record exists and is_completed is true */
  isCompleted: boolean
  /** When the item was completed */
  completedAt?: string
  /** Who completed the item */
  completedBy?: string
  /** Optional notes from the user */
  notes?: string
  /** Optional linked document */
  documentId?: string
  /** Completion record ID (null if no record exists yet) */
  completionId?: string
}

/**
 * Category summary with progress
 */
export interface ChecklistCategorySummary {
  category: ChecklistCategory
  label: string
  description: string
  totalItems: number
  completedItems: number
  mandatoryItems: number
  mandatoryCompleted: number
  items: ChecklistItemWithStatus[]
}

/**
 * Overall checklist progress
 */
export interface ChecklistProgress {
  totalItems: number
  completedItems: number
  mandatoryItems: number
  mandatoryCompleted: number
  percentComplete: number
  mandatoryPercentComplete: number
  categories: ChecklistCategorySummary[]
}

/**
 * Request to update a checklist item's completion status
 */
export interface UpdateChecklistItemRequest {
  tenantId: string
  registrationId?: string
  isCompleted: boolean
  completedBy?: string
  notes?: string
  documentId?: string
}

/**
 * Category display configuration
 */
export interface CategoryConfig {
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
}

/**
 * Category display configurations for the UI
 */
export const CATEGORY_CONFIG: Record<ChecklistCategory, CategoryConfig> = {
  documentation: {
    label: 'Documentation',
    description: 'Evidence and records required for Division 355 four-element test',
    color: '#8855FF',
    bgColor: 'rgba(136, 85, 255, 0.1)',
    borderColor: 'rgba(136, 85, 255, 0.3)',
    icon: '|=|',
  },
  registration: {
    label: 'AusIndustry Registration',
    description: 'Steps to register R&D activities with AusIndustry',
    color: '#00F5FF',
    bgColor: 'rgba(0, 245, 255, 0.1)',
    borderColor: 'rgba(0, 245, 255, 0.3)',
    icon: '>',
  },
  tax_return: {
    label: 'Tax Return',
    description: 'Schedule 16N and company tax return preparation',
    color: '#00FF88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    icon: '$',
  },
  post_submission: {
    label: 'Post-Submission',
    description: 'Record retention and amendment period tracking',
    color: '#FF8800',
    bgColor: 'rgba(255, 136, 0, 0.1)',
    borderColor: 'rgba(255, 136, 0, 0.3)',
    icon: '!',
  },
}

/**
 * All categories in display order
 */
export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  'documentation',
  'registration',
  'tax_return',
  'post_submission',
]

/**
 * Convert a database template row to ChecklistTemplate
 */
export function dbRowToChecklistTemplate(row: Record<string, unknown>): ChecklistTemplate {
  return {
    id: row.id as string,
    category: row.category as ChecklistCategory,
    itemKey: row.item_key as string,
    title: row.title as string,
    description: row.description as string | undefined,
    legislationReference: row.legislation_reference as string | undefined,
    isMandatory: (row.is_mandatory as boolean) ?? true,
    displayOrder: (row.display_order as number) ?? 0,
    helpUrl: row.help_url as string | undefined,
  }
}

/**
 * Convert a database checklist item row to ChecklistItem
 */
export function dbRowToChecklistItem(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    registrationId: (row.registration_id as string) ?? null,
    category: row.category as ChecklistCategory,
    itemKey: row.item_key as string,
    isCompleted: (row.is_completed as boolean) ?? false,
    completedAt: row.completed_at as string | undefined,
    completedBy: row.completed_by as string | undefined,
    notes: row.notes as string | undefined,
    documentId: row.document_id as string | undefined,
    createdAt: row.created_at as string,
  }
}

/**
 * Merge templates with completion data to produce display items
 */
export function mergeTemplatesWithCompletion(
  templates: ChecklistTemplate[],
  completions: ChecklistItem[]
): ChecklistItemWithStatus[] {
  const completionMap = new Map(
    completions.map((c) => [c.itemKey, c])
  )

  return templates.map((template) => {
    const completion = completionMap.get(template.itemKey)

    return {
      ...template,
      isCompleted: completion?.isCompleted ?? false,
      completedAt: completion?.completedAt,
      completedBy: completion?.completedBy,
      notes: completion?.notes,
      documentId: completion?.documentId,
      completionId: completion?.id,
    }
  })
}

/**
 * Calculate checklist progress from merged items
 */
export function calculateChecklistProgress(
  items: ChecklistItemWithStatus[]
): Omit<ChecklistProgress, 'categories'> {
  const totalItems = items.length
  const completedItems = items.filter((i) => i.isCompleted).length
  const mandatoryItems = items.filter((i) => i.isMandatory).length
  const mandatoryCompleted = items.filter((i) => i.isMandatory && i.isCompleted).length

  return {
    totalItems,
    completedItems,
    mandatoryItems,
    mandatoryCompleted,
    percentComplete: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    mandatoryPercentComplete:
      mandatoryItems > 0 ? Math.round((mandatoryCompleted / mandatoryItems) * 100) : 0,
  }
}

export default CATEGORY_CONFIG
