/**
 * Schedule 16N Field Definitions
 *
 * Field-by-field definitions and explanations for the R&D Tax Incentive
 * Schedule (Schedule 16N) that accompanies the company tax return.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive.
 */

/**
 * Individual field definition for Schedule 16N
 */
export interface Schedule16NField {
  fieldNumber: string
  label: string
  description: string
  dataType: 'text' | 'currency' | 'number' | 'date' | 'boolean'
  section: Schedule16NSection
  helpText: string
  legislationRef?: string
  atoGuidanceUrl?: string
  validationRules?: string[]
  autoPopulateFrom?: string
}

/**
 * Section of Schedule 16N
 */
export type Schedule16NSection =
  | 'entity_details'
  | 'registration_details'
  | 'expenditure'
  | 'offset_calculation'
  | 'clawback'
  | 'declaration'

/**
 * Section configuration
 */
export interface SectionConfig {
  id: Schedule16NSection
  title: string
  description: string
  order: number
}

/**
 * Section configurations
 */
export const SCHEDULE_16N_SECTIONS: SectionConfig[] = [
  {
    id: 'entity_details',
    title: 'Part A - Entity Details',
    description: 'Company identification and income year information',
    order: 1,
  },
  {
    id: 'registration_details',
    title: 'Part B - Registration Details',
    description: 'AusIndustry registration reference and activity information',
    order: 2,
  },
  {
    id: 'expenditure',
    title: 'Part C - R&D Expenditure',
    description: 'Breakdown of eligible R&D expenditure by category',
    order: 3,
  },
  {
    id: 'offset_calculation',
    title: 'Part D - Offset Calculation',
    description: 'Calculation of the R&D tax offset amount',
    order: 4,
  },
  {
    id: 'clawback',
    title: 'Part E - Clawback and Adjustments',
    description: 'Feedstock adjustments and balancing adjustments',
    order: 5,
  },
  {
    id: 'declaration',
    title: 'Part F - Declaration',
    description: 'Authorised signatory declaration',
    order: 6,
  },
]

/**
 * All Schedule 16N fields with explanations
 */
export const SCHEDULE_16N_FIELDS: Schedule16NField[] = [
  // Part A - Entity Details
  {
    fieldNumber: 'A1',
    label: 'Company Name',
    description: 'The legal name of the entity claiming the R&D tax offset.',
    dataType: 'text',
    section: 'entity_details',
    helpText: 'Must match the name on your ATO registration.',
    autoPopulateFrom: 'xero_organisation_name',
  },
  {
    fieldNumber: 'A2',
    label: 'ABN',
    description: 'Australian Business Number of the R&D entity.',
    dataType: 'text',
    section: 'entity_details',
    helpText: 'The 11-digit ABN registered with the ATO.',
    autoPopulateFrom: 'xero_organisation_abn',
  },
  {
    fieldNumber: 'A3',
    label: 'Income Year',
    description: 'The financial year for which the R&D offset is being claimed.',
    dataType: 'text',
    section: 'entity_details',
    helpText: 'Format: YYYY-YY (e.g., 2024-25 for 1 July 2024 to 30 June 2025).',
  },
  {
    fieldNumber: 'A4',
    label: 'Aggregated Turnover',
    description:
      'The aggregated turnover of the R&D entity for the income year. ' +
      'This determines the rate of the R&D tax offset.',
    dataType: 'currency',
    section: 'entity_details',
    helpText:
      'Entities with aggregated turnover less than $20 million receive ' +
      'a refundable 43.5% offset. Entities with $20 million or more receive ' +
      'a non-refundable offset at the corporate tax rate plus an intensity premium.',
    legislationRef: 's 355-100 ITAA 1997',
    validationRules: ['Must be a positive number', 'Determines offset rate'],
    autoPopulateFrom: 'xero_total_revenue',
  },

  // Part B - Registration Details
  {
    fieldNumber: 'B1',
    label: 'AusIndustry Registration Number',
    description: 'The registration reference number received from AusIndustry.',
    dataType: 'text',
    section: 'registration_details',
    helpText:
      'This is the reference number from your AusIndustry registration confirmation. ' +
      'You must have a valid registration to claim the offset.',
    legislationRef: 's 27A IRDA 1986',
    validationRules: ['Must be a valid AusIndustry reference number'],
    autoPopulateFrom: 'rnd_registration_reference',
  },
  {
    fieldNumber: 'B2',
    label: 'Number of Core R&D Activities',
    description: 'Total number of core R&D activities registered with AusIndustry.',
    dataType: 'number',
    section: 'registration_details',
    helpText:
      'Core R&D activities are experimental activities that directly ' +
      'address the four elements of the Division 355 test.',
    legislationRef: 's 355-25 ITAA 1997',
    validationRules: ['Must be at least 1'],
  },
  {
    fieldNumber: 'B3',
    label: 'Number of Supporting R&D Activities',
    description: 'Total number of supporting R&D activities registered.',
    dataType: 'number',
    section: 'registration_details',
    helpText:
      'Supporting activities are directly related to core R&D activities ' +
      'and are undertaken for the dominant purpose of supporting core activities.',
    legislationRef: 's 355-30 ITAA 1997',
    validationRules: ['Can be zero'],
  },

  // Part C - Expenditure
  {
    fieldNumber: 'C1',
    label: 'Total R&D Entity Expenditure',
    description:
      'Total expenditure on R&D activities conducted by the R&D entity itself.',
    dataType: 'currency',
    section: 'expenditure',
    helpText:
      'Include salary costs, materials, depreciation, and other directly ' +
      'attributable costs for R&D activities performed by your own staff.',
    legislationRef: 's 355-205 ITAA 1997',
    validationRules: ['Must be a positive number or zero'],
    autoPopulateFrom: 'rnd_total_expenditure',
  },
  {
    fieldNumber: 'C2',
    label: 'Contractor Expenditure (Australian)',
    description: 'Expenditure on R&D activities performed by Australian contractors.',
    dataType: 'currency',
    section: 'expenditure',
    helpText:
      'R&D activities performed by contractors within Australia. ' +
      'You can generally claim the full amount paid to the contractor.',
    legislationRef: 's 355-210 ITAA 1997',
    validationRules: ['Must be zero or positive'],
  },
  {
    fieldNumber: 'C3',
    label: 'Contractor Expenditure (Overseas)',
    description: 'Expenditure on R&D activities performed by overseas contractors.',
    dataType: 'currency',
    section: 'expenditure',
    helpText:
      'R&D activities performed overseas require an advance/overseas finding ' +
      'from AusIndustry. The expenditure must satisfy additional conditions.',
    legislationRef: 's 355-210 ITAA 1997',
    validationRules: [
      'Requires advance/overseas finding',
      'Must be zero or positive',
    ],
  },
  {
    fieldNumber: 'C4',
    label: 'Total Notional Deductions',
    description: 'Sum of all R&D expenditure amounts (C1 + C2 + C3).',
    dataType: 'currency',
    section: 'expenditure',
    helpText: 'This is the total amount of R&D expenditure you are claiming.',
    legislationRef: 's 355-205 ITAA 1997',
    validationRules: ['Must equal C1 + C2 + C3'],
  },

  // Part D - Offset Calculation
  {
    fieldNumber: 'D1',
    label: 'R&D Offset Rate',
    description: 'The applicable R&D tax offset rate based on aggregated turnover.',
    dataType: 'number',
    section: 'offset_calculation',
    helpText:
      'For aggregated turnover less than $20M: 43.5% (refundable). ' +
      'For $20M or more: corporate tax rate + R&D premium (non-refundable). ' +
      'The R&D intensity premium provides additional offset for expenditure ' +
      'exceeding 2% of total expenses.',
    legislationRef: 's 355-100 ITAA 1997',
    validationRules: ['43.5% for turnover < $20M'],
  },
  {
    fieldNumber: 'D2',
    label: 'R&D Tax Offset Amount',
    description: 'The calculated R&D tax offset (Total Notional Deductions x Offset Rate).',
    dataType: 'currency',
    section: 'offset_calculation',
    helpText:
      'This is the tax offset amount that reduces your tax liability. ' +
      'For eligible small businesses (turnover < $20M), excess offset is ' +
      'refundable up to the $150,000 refundable offset cap.',
    legislationRef: 's 355-100 ITAA 1997',
    validationRules: ['Must equal C4 x D1'],
    autoPopulateFrom: 'rnd_estimated_offset',
  },
  {
    fieldNumber: 'D3',
    label: 'Refundable Offset Cap',
    description: 'Maximum refundable portion of the R&D tax offset.',
    dataType: 'currency',
    section: 'offset_calculation',
    helpText:
      'The refundable R&D tax offset is capped at $150,000 for income years ' +
      'commencing on or after 1 July 2024. Excess becomes a non-refundable offset.',
    legislationRef: 's 355-100(3) ITAA 1997',
    validationRules: ['$150,000 cap applies from FY2024-25'],
  },

  // Part E - Clawback
  {
    fieldNumber: 'E1',
    label: 'Feedstock Adjustment',
    description:
      'Reduction to notional deductions for feedstock inputs that produce marketable products.',
    dataType: 'currency',
    section: 'clawback',
    helpText:
      'If your R&D activities produce goods that are sold, you may need to ' +
      'reduce your R&D expenditure by one-third of the feedstock revenue. ' +
      'This prevents double-dipping on production costs.',
    legislationRef: 's 355-465 ITAA 1997',
    validationRules: ['Only applies if R&D produces marketable output'],
  },
  {
    fieldNumber: 'E2',
    label: 'Balancing Adjustment',
    description: 'Adjustment for disposal or change of use of R&D depreciating assets.',
    dataType: 'currency',
    section: 'clawback',
    helpText:
      'If you dispose of or stop using an asset for R&D after claiming ' +
      'R&D deductions on it, a balancing adjustment may be required.',
    legislationRef: 's 355-315 ITAA 1997',
    validationRules: ['Only applies if assets disposed or repurposed'],
  },

  // Part F - Declaration
  {
    fieldNumber: 'F1',
    label: 'Authorised Signatory',
    description: 'Name of the person authorised to sign the R&D schedule.',
    dataType: 'text',
    section: 'declaration',
    helpText:
      'Must be a director or public officer of the company. ' +
      'The signatory declares that the information is true and correct.',
  },
  {
    fieldNumber: 'F2',
    label: 'Declaration Date',
    description: 'Date the declaration is signed.',
    dataType: 'date',
    section: 'declaration',
    helpText: 'Must be on or before the date of tax return lodgement.',
    validationRules: ['Must not be a future date'],
  },
]

/**
 * Get fields by section
 */
export function getFieldsBySection(section: Schedule16NSection): Schedule16NField[] {
  return SCHEDULE_16N_FIELDS.filter((f) => f.section === section)
}

/**
 * Get a field by its number
 */
export function getFieldByNumber(fieldNumber: string): Schedule16NField | undefined {
  return SCHEDULE_16N_FIELDS.find((f) => f.fieldNumber === fieldNumber)
}

/**
 * Get fields that can be auto-populated
 */
export function getAutoPopulatableFields(): Schedule16NField[] {
  return SCHEDULE_16N_FIELDS.filter((f) => f.autoPopulateFrom)
}

export default SCHEDULE_16N_FIELDS
