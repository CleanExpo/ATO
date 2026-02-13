/**
 * Questionnaire Generator
 *
 * Automatically generates targeted questionnaires to fill data gaps identified during
 * tax analysis. Improves analysis confidence by collecting missing information from users.
 *
 * Data Gaps Addressed:
 * - Fuel purchases: Fuel type, litres, business use percentage
 * - Trust distributions: Beneficiary relationships, reimbursement patterns
 * - Assets: Off-road use classification, depreciation method selection
 * - Contacts: Entity type classification, related party relationships
 * - Superannuation: Contribution type clarification
 *
 * Workflow:
 * 1. Analysis engines flag missing data with confidence scores
 * 2. Questionnaire generator creates targeted questions
 * 3. User answers questions via UI
 * 4. Responses stored in database
 * 5. Re-analysis triggered with improved data
 * 6. Confidence scores updated
 */

export type QuestionType =
  | 'single_choice' // Radio buttons
  | 'multiple_choice' // Checkboxes
  | 'text_input' // Free text
  | 'number_input' // Numeric value
  | 'percentage_input' // 0-100 percentage
  | 'date_input' // Date picker
  | 'yes_no'; // Boolean

export type QuestionCategory =
  | 'fuel_tax_credits'
  | 'trust_distributions'
  | 'asset_classification'
  | 'contact_relationships'
  | 'superannuation'
  | 'deductions'
  | 'rnd_eligibility';

export interface QuestionOption {
  value: string;
  label: string;
  help_text?: string;
}

export interface Question {
  question_id: string;
  category: QuestionCategory;
  question_type: QuestionType;
  question_text: string;
  help_text?: string;
  required: boolean;
  options?: QuestionOption[]; // For single_choice and multiple_choice
  validation_rules?: {
    min?: number;
    max?: number;
    regex?: string;
    error_message?: string;
  };

  // Context about why this question is being asked
  context: {
    transaction_id?: string;
    contact_id?: string;
    asset_id?: string;
    employee_id?: string;
    analysis_engine: string;
    confidence_impact: 'high' | 'medium' | 'low'; // Impact on analysis confidence
    estimated_tax_impact?: number; // Potential $ impact if answered
  };
}

export interface Questionnaire {
  questionnaire_id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: QuestionCategory;

  questions: Question[];

  // Questionnaire metadata
  created_from_analysis_id?: string; // Which analysis triggered this
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_completion_time_minutes: number;
  potential_tax_benefit: number; // Estimated $ value if completed

  // State
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  created_at: string;
  completed_at?: string;
}

export interface QuestionnaireResponse {
  questionnaire_id: string;
  question_id: string;
  response_value: string | string[] | number | boolean;
  responded_at: string;
  responded_by_user_id: string;
}

/**
 * Generate questionnaire from fuel tax credit analysis gaps
 */
export function generateFuelTaxCreditQuestionnaire(
  tenantId: string,
  analysisId: string,
  missingDataFlags: string[],
  lowConfidenceTransactions: Array<{
    transaction_id: string;
    supplier_name: string;
    amount: number;
    description?: string;
    fuel_type?: string;
    fuel_litres?: number;
    business_use_percentage?: number;
    confidence_level: 'high' | 'medium' | 'low';
  }>
): Questionnaire {
  const questions: Question[] = [];

  // For each low-confidence transaction, generate targeted questions
  for (const txn of lowConfidenceTransactions) {
    const baseQuestionId = `fuel_${txn.transaction_id}`;

    // Question 1: Fuel type (if unknown)
    if (!txn.fuel_type || txn.fuel_type === 'unknown') {
      questions.push({
        question_id: `${baseQuestionId}_type`,
        category: 'fuel_tax_credits',
        question_type: 'single_choice',
        question_text: `What type of fuel was purchased from ${txn.supplier_name} on this transaction?`,
        help_text: 'Diesel and petrol have $0.479/L credit rate, LPG has $0.198/L.',
        required: true,
        options: [
          { value: 'diesel', label: 'Diesel', help_text: 'Credit: $0.479 per litre' },
          { value: 'petrol', label: 'Petrol (Unleaded/Premium)', help_text: 'Credit: $0.479 per litre (off-road use only)' },
          { value: 'lpg', label: 'LPG / Autogas', help_text: 'Credit: $0.198 per litre' },
        ],
        context: {
          transaction_id: txn.transaction_id,
          analysis_engine: 'fuel_tax_credits',
          confidence_impact: 'high',
          estimated_tax_impact: txn.amount * 0.2, // Estimate 20% of purchase as potential credit
        },
      });
    }

    // Question 2: Fuel litres (if missing or estimated)
    if (!txn.fuel_litres) {
      questions.push({
        question_id: `${baseQuestionId}_litres`,
        category: 'fuel_tax_credits',
        question_type: 'number_input',
        question_text: `How many litres of fuel were purchased in this ${txn.supplier_name} transaction?`,
        help_text: 'Check your fuel docket or receipt. This is required to calculate the exact fuel tax credit.',
        required: true,
        validation_rules: {
          min: 0.1,
          max: 10000,
          error_message: 'Please enter a valid number of litres (0.1 - 10,000)',
        },
        context: {
          transaction_id: txn.transaction_id,
          analysis_engine: 'fuel_tax_credits',
          confidence_impact: 'high',
          estimated_tax_impact: 50, // Placeholder
        },
      });
    }

    // Question 3: Business use percentage (if not 100%)
    if (txn.business_use_percentage === undefined || txn.business_use_percentage === 100) {
      questions.push({
        question_id: `${baseQuestionId}_business_use`,
        category: 'fuel_tax_credits',
        question_type: 'percentage_input',
        question_text: `What percentage of this fuel was used for business purposes?`,
        help_text: 'If this vehicle is used for both business and private purposes, enter the business use percentage from your logbook. 100% = business use only.',
        required: true,
        validation_rules: {
          min: 0,
          max: 100,
          error_message: 'Please enter a percentage between 0 and 100',
        },
        context: {
          transaction_id: txn.transaction_id,
          analysis_engine: 'fuel_tax_credits',
          confidence_impact: 'medium',
        },
      });
    }

    // Question 4: Off-road use (for petrol eligibility)
    if (txn.fuel_type === 'petrol' || !txn.fuel_type) {
      questions.push({
        question_id: `${baseQuestionId}_off_road`,
        category: 'fuel_tax_credits',
        question_type: 'yes_no',
        question_text: `Was this fuel used in a heavy vehicle (≥4.5 tonnes GVM) or off-road machinery?`,
        help_text: 'Petrol for light vehicles on public roads (<4.5t GVM) is NOT eligible for fuel tax credits. Heavy vehicles, trucks, farm machinery, and construction equipment qualify.',
        required: true,
        context: {
          transaction_id: txn.transaction_id,
          analysis_engine: 'fuel_tax_credits',
          confidence_impact: 'high',
          estimated_tax_impact: txn.amount * 0.2,
        },
      });
    }
  }

  // Calculate estimated completion time (2 minutes per transaction with questions)
  const estimatedTime = Math.ceil((questions.length / 4) * 2); // 4 questions = 2 minutes

  // Calculate potential tax benefit
  const potentialBenefit = lowConfidenceTransactions.reduce(
    (sum, txn) => sum + (txn.amount * 0.2), // Estimate 20% of fuel cost as credit
    0
  );

  return {
    questionnaire_id: `fuel_tax_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Fuel Tax Credits - Missing Information',
    description: `We found ${lowConfidenceTransactions.length} fuel purchases with missing information. Answering these questions will help us calculate your exact fuel tax credits.`,
    category: 'fuel_tax_credits',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialBenefit > 5000 ? 'high' : potentialBenefit > 1000 ? 'medium' : 'low',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialBenefit,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire from trust distribution analysis gaps
 */
export function generateTrustDistributionQuestionnaire(
  tenantId: string,
  analysisId: string,
  beneficiaries: Array<{
    beneficiary_id: string;
    beneficiary_name: string;
    total_distributed: number;
    entity_type?: string;
    is_related_party?: boolean;
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const beneficiary of beneficiaries) {
    const baseQuestionId = `trust_${beneficiary.beneficiary_id}`;

    // Question 1: Entity type classification
    if (!beneficiary.entity_type || beneficiary.entity_type === 'unknown') {
      questions.push({
        question_id: `${baseQuestionId}_entity_type`,
        category: 'trust_distributions',
        question_type: 'single_choice',
        question_text: `What type of entity is ${beneficiary.beneficiary_name}?`,
        help_text: 'This determines the tax rate applied to trust distributions and Section 100A risk.',
        required: true,
        options: [
          { value: 'individual', label: 'Individual Person', help_text: 'Marginal tax rate (19-45%)' },
          { value: 'company', label: 'Company', help_text: 'Flat 25-30% tax rate' },
          { value: 'trust', label: 'Trust', help_text: 'May flow through to beneficiaries' },
          { value: 'partnership', label: 'Partnership', help_text: 'Income split between partners' },
        ],
        context: {
          contact_id: beneficiary.beneficiary_id,
          analysis_engine: 'trust_distributions',
          confidence_impact: 'high',
          estimated_tax_impact: beneficiary.total_distributed * 0.15, // Estimate tax differential
        },
      });
    }

    // Question 2: Related party relationship
    if (beneficiary.is_related_party === undefined) {
      questions.push({
        question_id: `${baseQuestionId}_related_party`,
        category: 'trust_distributions',
        question_type: 'multiple_choice',
        question_text: `What is ${beneficiary.beneficiary_name}'s relationship to the trust or its controllers?`,
        help_text: 'Related parties include directors, shareholders, family members, and associated entities. This affects Section 100A risk assessment.',
        required: true,
        options: [
          { value: 'director', label: 'Director of trustee company' },
          { value: 'shareholder', label: 'Shareholder of trustee company' },
          { value: 'family', label: 'Family member of controller' },
          { value: 'associated_entity', label: 'Associated entity (common ownership/control)' },
          { value: 'employee', label: 'Employee' },
          { value: 'none', label: 'No relationship - unrelated third party' },
        ],
        context: {
          contact_id: beneficiary.beneficiary_id,
          analysis_engine: 'trust_distributions',
          confidence_impact: 'high',
        },
      });
    }

    // Question 3: Reimbursement agreement check
    questions.push({
      question_id: `${baseQuestionId}_reimbursement`,
      category: 'trust_distributions',
      question_type: 'yes_no',
      question_text: `Did ${beneficiary.beneficiary_name} loan money back to the trust or make any payment/benefit to the trust after receiving this distribution?`,
      help_text: 'Section 100A anti-avoidance rule applies if there is a "reimbursement agreement" where the beneficiary provides anything back to the trust or its controllers. This can result in 45% tax to the trustee.',
      required: true,
      context: {
        contact_id: beneficiary.beneficiary_id,
        analysis_engine: 'trust_distributions',
        confidence_impact: 'high',
        estimated_tax_impact: beneficiary.total_distributed * 0.45, // Section 100A worst case
      },
    });
  }

  const estimatedTime = Math.ceil((questions.length / 3) * 3); // 3 questions = 3 minutes
  const potentialImpact = beneficiaries.reduce((sum, b) => sum + b.total_distributed, 0) * 0.15;

  return {
    questionnaire_id: `trust_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Trust Distributions - Compliance Review',
    description: `We need additional information about ${beneficiaries.length} beneficiaries to complete the Section 100A compliance analysis.`,
    category: 'trust_distributions',
    questions,
    created_from_analysis_id: analysisId,
    priority: 'high', // Trust compliance is always high priority
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialImpact,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire from asset classification gaps
 */
export function generateAssetClassificationQuestionnaire(
  tenantId: string,
  analysisId: string,
  assets: Array<{
    asset_id: string;
    asset_name: string;
    purchase_price: number;
    depreciation_method?: string;
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const asset of assets) {
    const baseQuestionId = `asset_${asset.asset_id}`;

    // Question: Instant write-off vs depreciation
    if (asset.purchase_price <= 20000) {
      questions.push({
        question_id: `${baseQuestionId}_instant_writeoff`,
        category: 'asset_classification',
        question_type: 'yes_no',
        question_text: `Do you want to claim instant asset write-off for "${asset.asset_name}" ($${asset.purchase_price.toLocaleString()})?`,
        help_text: 'Assets under $20,000 can be immediately deducted (instant write-off) instead of depreciated over years. Instant write-off provides faster tax benefit.',
        required: true,
        context: {
          asset_id: asset.asset_id,
          analysis_engine: 'asset_classification',
          confidence_impact: 'high',
          estimated_tax_impact: asset.purchase_price * 0.25, // Immediate deduction benefit
        },
      });
    }

    // Question: Depreciation method selection
    if (!asset.depreciation_method || asset.depreciation_method === 'None') {
      questions.push({
        question_id: `${baseQuestionId}_depreciation_method`,
        category: 'asset_classification',
        question_type: 'single_choice',
        question_text: `Which depreciation method do you want to use for "${asset.asset_name}"?`,
        help_text: 'Diminishing Value provides higher deductions in early years. Prime Cost provides consistent deductions. Most businesses prefer Diminishing Value.',
        required: true,
        options: [
          {
            value: 'diminishing_value',
            label: 'Diminishing Value (Reducing Balance)',
            help_text: 'Higher deductions in early years - recommended for most assets',
          },
          {
            value: 'prime_cost',
            label: 'Prime Cost (Straight Line)',
            help_text: 'Consistent deductions each year',
          },
        ],
        context: {
          asset_id: asset.asset_id,
          analysis_engine: 'asset_classification',
          confidence_impact: 'medium',
        },
      });
    }
  }

  const estimatedTime = Math.ceil(questions.length * 1.5); // 1.5 minutes per question
  const potentialBenefit = assets
    .filter(a => a.purchase_price <= 20000)
    .reduce((sum, a) => sum + a.purchase_price * 0.25, 0);

  return {
    questionnaire_id: `asset_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Fixed Assets - Depreciation Strategy',
    description: `Optimize your depreciation strategy for ${assets.length} assets to maximize tax deductions.`,
    category: 'asset_classification',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialBenefit > 10000 ? 'high' : 'medium',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialBenefit,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire for contact entity classification
 */
export function generateContactRelationshipsQuestionnaire(
  tenantId: string,
  analysisId: string,
  contacts: Array<{
    contact_id: string;
    contact_name: string;
    entity_type?: string;
    abn?: string;
    total_transaction_value: number;
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const contact of contacts) {
    const baseQuestionId = `contact_${contact.contact_id}`;

    // Question 1: Entity type classification
    if (!contact.entity_type || contact.entity_type === 'unknown') {
      questions.push({
        question_id: `${baseQuestionId}_entity_type`,
        category: 'contact_relationships',
        question_type: 'single_choice',
        question_text: `What type of entity is "${contact.contact_name}"?`,
        help_text: 'This affects tax treatment, withholding obligations, and deduction eligibility.',
        required: true,
        options: [
          { value: 'individual', label: 'Individual / Sole Trader' },
          { value: 'company', label: 'Company (Pty Ltd)' },
          { value: 'trust', label: 'Trust (Family, Unit, Discretionary)' },
          { value: 'partnership', label: 'Partnership' },
          { value: 'super_fund', label: 'Superannuation Fund (SMSF or APRA)' },
          { value: 'government', label: 'Government Entity' },
          { value: 'non_profit', label: 'Non-Profit / Charity' },
        ],
        context: {
          contact_id: contact.contact_id,
          analysis_engine: 'contact_relationships',
          confidence_impact: 'high',
          estimated_tax_impact: contact.total_transaction_value * 0.05,
        },
      });
    }

    // Question 2: ABN validation
    if (!contact.abn && contact.total_transaction_value > 1000) {
      questions.push({
        question_id: `${baseQuestionId}_abn`,
        category: 'contact_relationships',
        question_type: 'text_input',
        question_text: `What is the ABN for "${contact.contact_name}"?`,
        help_text: 'Australian Business Number (11 digits). Required for GST credit claims and avoiding withholding tax on payments over $75.',
        required: false,
        validation_rules: {
          regex: '^\\d{11}$',
          error_message: 'ABN must be exactly 11 digits',
        },
        context: {
          contact_id: contact.contact_id,
          analysis_engine: 'contact_relationships',
          confidence_impact: 'medium',
        },
      });
    }

    // Question 3: Related party status
    questions.push({
      question_id: `${baseQuestionId}_related_party`,
      category: 'contact_relationships',
      question_type: 'yes_no',
      question_text: `Is "${contact.contact_name}" a related party (director, shareholder, family member, or associated entity)?`,
      help_text: 'Related party transactions have special tax treatment and documentation requirements (ITAA 1936 Division 7A, TR 2016/1).',
      required: true,
      context: {
        contact_id: contact.contact_id,
        analysis_engine: 'contact_relationships',
        confidence_impact: 'high',
        estimated_tax_impact: contact.total_transaction_value * 0.1,
      },
    });
  }

  const estimatedTime = Math.ceil(questions.length * 1.5); // 1.5 minutes per question
  const potentialImpact = contacts.reduce((sum, c) => sum + c.total_transaction_value * 0.05, 0);

  return {
    questionnaire_id: `contact_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Contact Relationships - Entity Classification',
    description: `Classify ${contacts.length} contacts to ensure correct tax treatment and compliance.`,
    category: 'contact_relationships',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialImpact > 10000 ? 'high' : 'medium',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialImpact,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire for superannuation contribution clarification
 */
export function generateSuperannuationQuestionnaire(
  tenantId: string,
  analysisId: string,
  employees: Array<{
    employee_id: string;
    employee_name: string;
    unclear_contributions: number;
    total_super: number;
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const employee of employees) {
    const baseQuestionId = `super_${employee.employee_id}`;

    // Question: Contribution type clarification
    questions.push({
      question_id: `${baseQuestionId}_contribution_type`,
      category: 'superannuation',
      question_type: 'single_choice',
      question_text: `What type of superannuation contributions were made for ${employee.employee_name}?`,
      help_text: 'This determines whether contributions count towards concessional cap ($30,000 FY2024-25) or non-concessional cap ($120,000).',
      required: true,
      options: [
        {
          value: 'sg',
          label: 'Superannuation Guarantee (SG) - Employer mandatory',
          help_text: 'Concessional - counts towards $30k cap',
        },
        {
          value: 'salary_sacrifice',
          label: 'Salary Sacrifice - Pre-tax employee contributions',
          help_text: 'Concessional - counts towards $30k cap',
        },
        {
          value: 'employer_additional',
          label: 'Employer Additional - Voluntary employer contributions',
          help_text: 'Concessional - counts towards $30k cap',
        },
        {
          value: 'personal_deductible',
          label: 'Personal Deductible - Post-tax with notice of intent',
          help_text: 'Concessional - counts towards $30k cap',
        },
        {
          value: 'non_concessional',
          label: 'Non-Concessional - Post-tax personal contributions',
          help_text: 'Non-concessional - counts towards $120k cap',
        },
      ],
      context: {
        employee_id: employee.employee_id,
        analysis_engine: 'superannuation',
        confidence_impact: 'high',
        estimated_tax_impact: employee.unclear_contributions * 0.15, // Division 291 tax risk
      },
    });

    // Question: Catch-up concessional contributions
    if (employee.total_super > 27500) {
      questions.push({
        question_id: `${baseQuestionId}_catchup`,
        category: 'superannuation',
        question_type: 'yes_no',
        question_text: `Did ${employee.employee_name} use carry-forward concessional contributions (unused cap from previous years)?`,
        help_text: 'If total super balance < $500k, can carry forward unused cap from last 5 years. Affects Division 291 tax calculation.',
        required: true,
        context: {
          employee_id: employee.employee_id,
          analysis_engine: 'superannuation',
          confidence_impact: 'high',
          estimated_tax_impact: (employee.total_super - 27500) * 0.15,
        },
      });
    }
  }

  const estimatedTime = Math.ceil(questions.length * 2); // 2 minutes per question
  const potentialImpact = employees.reduce((sum, e) => sum + e.unclear_contributions * 0.15, 0);

  return {
    questionnaire_id: `super_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Superannuation Contributions - Type Clarification',
    description: `Clarify contribution types for ${employees.length} employees to ensure correct cap calculations.`,
    category: 'superannuation',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialImpact > 5000 ? 'high' : 'medium',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialImpact,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire for deduction eligibility verification
 */
export function generateDeductionQuestionnaire(
  tenantId: string,
  analysisId: string,
  expenses: Array<{
    transaction_id: string;
    description: string;
    amount: number;
    account_name: string;
    deduction_category?: string;
    business_purpose_unclear?: boolean;
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const expense of expenses) {
    const baseQuestionId = `deduction_${expense.transaction_id}`;

    // Question 1: Business purpose test (Section 8-1)
    if (expense.business_purpose_unclear) {
      questions.push({
        question_id: `${baseQuestionId}_business_purpose`,
        category: 'deductions',
        question_type: 'yes_no',
        question_text: `Was this expense (${expense.description} - $${expense.amount.toLocaleString()}) incurred for the purpose of producing assessable income?`,
        help_text: 'Section 8-1 ITAA 1997: Deductions must be incurred in gaining or producing assessable income. Private or capital expenses are not deductible.',
        required: true,
        context: {
          transaction_id: expense.transaction_id,
          analysis_engine: 'deductions',
          confidence_impact: 'high',
          estimated_tax_impact: expense.amount * 0.25, // Tax saved if deductible
        },
      });
    }

    // Question 2: Deduction category
    if (!expense.deduction_category) {
      questions.push({
        question_id: `${baseQuestionId}_category`,
        category: 'deductions',
        question_type: 'single_choice',
        question_text: `Which deduction category best describes: "${expense.description}"?`,
        help_text: 'Categorisation affects timing of deduction (immediate vs depreciable) and specific eligibility rules.',
        required: true,
        options: [
          { value: 'operating_expense', label: 'Operating Expense (immediate deduction)', help_text: 'Office supplies, utilities, rent' },
          { value: 'repairs_maintenance', label: 'Repairs & Maintenance', help_text: 'Immediate if repairs existing asset' },
          { value: 'employee_costs', label: 'Employee Costs', help_text: 'Salaries, super, training' },
          { value: 'marketing', label: 'Marketing & Advertising', help_text: 'Ads, website, promotions' },
          { value: 'professional_fees', label: 'Professional Fees', help_text: 'Accounting, legal, consulting' },
          { value: 'travel', label: 'Travel & Accommodation', help_text: 'Business travel only' },
          { value: 'vehicle', label: 'Vehicle Expenses', help_text: 'Fuel, registration, insurance' },
          { value: 'insurance', label: 'Insurance', help_text: 'Business insurance premiums' },
          { value: 'interest', label: 'Interest & Bank Fees', help_text: 'Business loan interest' },
          { value: 'depreciation', label: 'Depreciating Asset', help_text: 'Equipment, furniture (depreciable)' },
          { value: 'private', label: 'Private / Non-Deductible', help_text: 'Personal expense' },
        ],
        context: {
          transaction_id: expense.transaction_id,
          analysis_engine: 'deductions',
          confidence_impact: 'medium',
        },
      });
    }

    // Question 3: Private use apportionment (if dual purpose)
    if (expense.account_name.toLowerCase().includes('vehicle') ||
        expense.account_name.toLowerCase().includes('phone') ||
        expense.account_name.toLowerCase().includes('internet')) {
      questions.push({
        question_id: `${baseQuestionId}_business_percentage`,
        category: 'deductions',
        question_type: 'percentage_input',
        question_text: `What percentage of this expense (${expense.description}) was for business use?`,
        help_text: 'If used for both business and private purposes, only the business portion is deductible. Use logbook or reasonable estimate.',
        required: true,
        validation_rules: {
          min: 0,
          max: 100,
          error_message: 'Please enter a percentage between 0 and 100',
        },
        context: {
          transaction_id: expense.transaction_id,
          analysis_engine: 'deductions',
          confidence_impact: 'high',
          estimated_tax_impact: expense.amount * 0.25 * 0.5, // Assume 50% private use if unclear
        },
      });
    }
  }

  const estimatedTime = Math.ceil(questions.length * 1.5); // 1.5 minutes per question
  const potentialImpact = expenses.reduce((sum, e) => sum + e.amount * 0.25, 0);

  return {
    questionnaire_id: `deduction_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'Deduction Eligibility - Business Purpose Verification',
    description: `Verify eligibility for ${expenses.length} expense deductions under Section 8-1.`,
    category: 'deductions',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialImpact > 20000 ? 'high' : 'medium',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialImpact,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate questionnaire for R&D Tax Incentive eligibility (4-element test)
 */
export function generateRndEligibilityQuestionnaire(
  tenantId: string,
  analysisId: string,
  activities: Array<{
    activity_id: string;
    activity_description: string;
    total_expenditure: number;
    confidence_level?: 'high' | 'medium' | 'low';
  }>
): Questionnaire {
  const questions: Question[] = [];

  for (const activity of activities) {
    const baseQuestionId = `rnd_${activity.activity_id}`;

    // Question 1: New knowledge (Element 1)
    questions.push({
      question_id: `${baseQuestionId}_new_knowledge`,
      category: 'rnd_eligibility',
      question_type: 'yes_no',
      question_text: `Did this activity (${activity.activity_description}) generate new knowledge?`,
      help_text: 'Element 1: The activity must generate new knowledge, not just apply existing knowledge. New knowledge = information not publicly available or deducible by competent professionals.',
      required: true,
      context: {
        analysis_engine: 'rnd_eligibility',
        confidence_impact: 'high',
        estimated_tax_impact: activity.total_expenditure * 0.435,
      },
    });

    // Question 2: Outcome unknown (Element 2)
    questions.push({
      question_id: `${baseQuestionId}_outcome_unknown`,
      category: 'rnd_eligibility',
      question_type: 'yes_no',
      question_text: `Was the outcome of this activity unable to be determined in advance?`,
      help_text: 'Element 2: At the start of the activity, the outcome could not be known or determined by a competent professional. Uncertainty must be technical, not commercial.',
      required: true,
      context: {
        analysis_engine: 'rnd_eligibility',
        confidence_impact: 'high',
        estimated_tax_impact: activity.total_expenditure * 0.435,
      },
    });

    // Question 3: Systematic approach (Element 3)
    questions.push({
      question_id: `${baseQuestionId}_systematic`,
      category: 'rnd_eligibility',
      question_type: 'yes_no',
      question_text: `Did this activity follow a systematic progression of work (hypothesis → experiment → evaluation)?`,
      help_text: 'Element 3: The activity must be a systematic progression, not ad-hoc trial and error. Must use scientific method with documented hypotheses, tests, and results.',
      required: true,
      context: {
        analysis_engine: 'rnd_eligibility',
        confidence_impact: 'high',
        estimated_tax_impact: activity.total_expenditure * 0.435,
      },
    });

    // Question 4: Scientific principles (Element 4)
    questions.push({
      question_id: `${baseQuestionId}_scientific_principles`,
      category: 'rnd_eligibility',
      question_type: 'yes_no',
      question_text: `Was this activity based on established scientific or engineering principles?`,
      help_text: 'Element 4: The activity must be based on principles of established science (physics, chemistry, biology, engineering, computer science). Excludes social sciences, arts, humanities.',
      required: true,
      context: {
        analysis_engine: 'rnd_eligibility',
        confidence_impact: 'high',
        estimated_tax_impact: activity.total_expenditure * 0.435,
      },
    });

    // Question 5: Documentation evidence
    questions.push({
      question_id: `${baseQuestionId}_documentation`,
      category: 'rnd_eligibility',
      question_type: 'multiple_choice',
      question_text: `What documentation exists for this R&D activity?`,
      help_text: 'Strong documentation improves ATO audit defence. Check all that apply.',
      required: false,
      options: [
        { value: 'project_plan', label: 'Project plan with hypotheses and objectives' },
        { value: 'technical_reports', label: 'Technical reports or lab notebooks' },
        { value: 'test_results', label: 'Test results and data analysis' },
        { value: 'code_commits', label: 'Code commits and version control history' },
        { value: 'meeting_minutes', label: 'Meeting minutes discussing technical challenges' },
        { value: 'literature_review', label: 'Literature review or patent search' },
        { value: 'none', label: 'No formal documentation' },
      ],
      context: {
        analysis_engine: 'rnd_eligibility',
        confidence_impact: 'medium',
      },
    });
  }

  const estimatedTime = Math.ceil(questions.length * 2.5); // 2.5 minutes per activity (5 questions)
  const potentialBenefit = activities.reduce((sum, a) => sum + a.total_expenditure * 0.435, 0);

  return {
    questionnaire_id: `rnd_${analysisId}_${Date.now()}`,
    tenant_id: tenantId,
    title: 'R&D Tax Incentive - Eligibility Assessment',
    description: `Assess ${activities.length} activities against the 4-element test for Division 355 R&D Tax Incentive.`,
    category: 'rnd_eligibility',
    questions,
    created_from_analysis_id: analysisId,
    priority: potentialBenefit > 50000 ? 'critical' : potentialBenefit > 20000 ? 'high' : 'medium',
    estimated_completion_time_minutes: estimatedTime,
    potential_tax_benefit: potentialBenefit,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

/**
 * Consolidate multiple questionnaires and prioritize
 */
export function prioritizeQuestionnaires(
  questionnaires: Questionnaire[]
): Questionnaire[] {
  return questionnaires.sort((a, b) => {
    // Priority order: critical > high > medium > low
    const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Secondary sort by potential tax benefit (descending)
    return b.potential_tax_benefit - a.potential_tax_benefit;
  });
}
