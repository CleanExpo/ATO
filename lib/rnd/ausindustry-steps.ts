/**
 * AusIndustry Registration Steps
 *
 * Step-by-step content for the AusIndustry R&D registration process.
 * Guides users through each stage from identity setup to confirmation.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive registration.
 * Industry Research and Development Act (IRDA) 1986.
 */

/**
 * Single step in the AusIndustry registration process
 */
export interface AusIndustryStep {
  step: number
  title: string
  description: string
  url?: string
  estimatedMinutes: number
  tips: string[]
  pitfalls: string[]
  relatedChecklistItems: string[]
}

/**
 * AusIndustry registration process steps
 */
export const AUSINDUSTRY_STEPS: AusIndustryStep[] = [
  {
    step: 1,
    title: 'Set Up myGovID',
    description:
      'Create or verify your myGovID digital identity. This is required to access ' +
      'the business.gov.au portal where R&D registrations are submitted.',
    url: 'https://www.mygovid.gov.au/',
    estimatedMinutes: 15,
    tips: [
      'Use Standard or Strong identity strength (Basic is not sufficient)',
      'Link your myGovID to the Relationship Authorisation Manager (RAM)',
      'Ensure you have principal authority or are a nominated representative for the company',
      'Have your personal identification documents ready (passport, drivers licence)',
    ],
    pitfalls: [
      'Basic identity strength will not allow R&D registration',
      'If you are not listed as a director, you will need a RAM authorisation from a principal authority',
      'myGovID setup can take several days if identity verification fails the first time',
    ],
    relatedChecklistItems: ['reg_mygovid'],
  },
  {
    step: 2,
    title: 'Access business.gov.au Portal',
    description:
      'Log into the business.gov.au portal using your myGovID. Navigate to the ' +
      'R&D Tax Incentive registration section.',
    url: 'https://business.gov.au/grants-and-programs/research-and-development-tax-incentive',
    estimatedMinutes: 5,
    tips: [
      'Ensure you have authorisation to act for the company via RAM',
      'Bookmark the R&D Tax Incentive page for easy access',
      'Check that your ABN is correctly linked to your myGovID',
    ],
    pitfalls: [
      'If you cannot see the R&D registration option, your RAM authorisation may be missing',
      'Browser compatibility issues can occur - use Chrome or Edge for best results',
    ],
    relatedChecklistItems: [],
  },
  {
    step: 3,
    title: 'Prepare Activity Descriptions',
    description:
      'Write clear, detailed descriptions of your R&D activities. Each activity ' +
      'must demonstrate the four elements of the Division 355 test: unknown outcome, ' +
      'systematic approach, generation of new knowledge, and scientific method.',
    estimatedMinutes: 60,
    tips: [
      'Describe what you set out to discover, not what you built',
      'Emphasise the technical uncertainty at the start of each activity',
      'Use language that demonstrates systematic investigation (hypothesis, experiment, analysis)',
      'Reference specific scientific or engineering principles used',
      'Keep each activity description focused on a single area of investigation',
    ],
    pitfalls: [
      'Describing routine software development as R&D (it must involve genuine uncertainty)',
      'Using marketing or business language instead of technical/scientific language',
      'Failing to differentiate core R&D activities from supporting activities',
      'Overly broad activity descriptions that cover multiple areas of investigation',
    ],
    relatedChecklistItems: ['reg_activity_description'],
  },
  {
    step: 4,
    title: 'Calculate Expenditure Estimate',
    description:
      'Determine the estimated R&D expenditure for each registered activity. ' +
      'This includes labour costs, contractor fees, materials, and depreciation ' +
      'of assets used in R&D activities.',
    estimatedMinutes: 30,
    tips: [
      'Include all eligible expenditure types: salary, contractor, materials, depreciation',
      'Apportion staff time between R&D and non-R&D activities using timesheets',
      'Include on-costs (superannuation, workers compensation, leave loading) for labour',
      'For contractors, only include amounts that relate to R&D activities',
      'Use the ATO R&D expenditure calculator if available',
    ],
    pitfalls: [
      'Including expenditure that is not directly related to R&D activities',
      'Double-counting expenditure across multiple activities',
      'Forgetting to apportion overhead costs correctly',
      'Not keeping adequate records to support the expenditure figures',
    ],
    relatedChecklistItems: ['reg_expenditure_estimate', 'doc_expenditure'],
  },
  {
    step: 5,
    title: 'Submit Registration to AusIndustry',
    description:
      'Complete and submit the R&D registration form via business.gov.au. ' +
      'Registration must be submitted within 10 months after the end of the ' +
      'income year in which the R&D activities were conducted (s 27A IRDA).',
    url: 'https://business.gov.au/grants-and-programs/research-and-development-tax-incentive',
    estimatedMinutes: 30,
    tips: [
      'Review all activity descriptions and expenditure estimates before submitting',
      'Save a copy of the complete registration form before submission',
      'Note the registration reference number immediately after submission',
      'Registration can be amended after submission if needed (before deadline)',
      'For FY2024-25 activities, the deadline is 30 April 2026',
    ],
    pitfalls: [
      'Missing the 10-month deadline (no extensions are available in most cases)',
      'Submitting incomplete or inaccurate information',
      'Not saving the confirmation/reference number',
      'Confusing registration deadline with tax return lodgement deadline',
    ],
    relatedChecklistItems: ['reg_submission'],
  },
  {
    step: 6,
    title: 'Save Registration Confirmation',
    description:
      'Record your AusIndustry registration reference number. This number is ' +
      'required when completing Schedule 16N in your company tax return.',
    estimatedMinutes: 5,
    tips: [
      'Save the confirmation email from AusIndustry',
      'Record the registration reference number in your tax file',
      'Share the reference number with your tax agent/accountant',
      'Keep a screenshot of the submission confirmation page',
    ],
    pitfalls: [
      'Not recording the reference number (it is needed for the tax return)',
      'Confusing the registration number with other government reference numbers',
    ],
    relatedChecklistItems: ['reg_confirmation'],
  },
  {
    step: 7,
    title: 'Complete Schedule 16N',
    description:
      'Complete the R&D Tax Incentive Schedule (Schedule 16N) as part of your ' +
      'company tax return. This schedule reports your R&D expenditure and ' +
      'calculates the tax offset.',
    estimatedMinutes: 45,
    tips: [
      'Use the AusIndustry registration reference number',
      'Ensure expenditure figures match your registration',
      'Cross-reference with your general ledger for accuracy',
      'Have your tax agent review the schedule before lodgement',
    ],
    pitfalls: [
      'Expenditure figures that do not match the registration',
      'Incorrect classification of core vs supporting activities',
      'Missing the clawback adjustment for feedstock expenditure if applicable',
      'Not including the schedule with the company tax return',
    ],
    relatedChecklistItems: ['tax_schedule_16n', 'tax_company_return'],
  },
]

/**
 * Calculate total estimated time for all steps
 */
export function calculateTotalEstimatedTime(): number {
  return AUSINDUSTRY_STEPS.reduce((total, step) => total + step.estimatedMinutes, 0)
}

/**
 * Get a step by number
 */
export function getStepByNumber(stepNumber: number): AusIndustryStep | undefined {
  return AUSINDUSTRY_STEPS.find((s) => s.step === stepNumber)
}

export default AUSINDUSTRY_STEPS
