/**
 * AI Forensic Analyzer
 *
 * Deep analysis of transactions using Google AI (Gemini) for tax optimization.
 *
 * Features:
 * - Division 355 (R&D) assessment with four-element test
 * - Division 8 (General deductions) eligibility
 * - Compliance flags (FBT, Division 7A)
 * - Confidence scoring (0-100%)
 * - Batch processing for efficiency
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'
import { createSupplierAnonymiser } from './pii-sanitizer'

// Initialize Google AI lazily to avoid errors when API key is missing
let genAI: GoogleGenerativeAI | null = null

function getGoogleAI(): GoogleGenerativeAI {
    if (!optionalConfig.googleAiApiKey) {
        throw new Error('GOOGLE_AI_API_KEY is not configured. Please add it to your Vercel environment variables.')
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(optionalConfig.googleAiApiKey)
    }
    return genAI
}

// Types
export interface TransactionContext {
    transactionID: string
    date: string
    description: string
    amount: number
    supplier?: string
    accountCode?: string
    lineItems?: Array<{
        description?: string
        quantity?: number
        unitAmount?: number
        accountCode?: string
    }>
}

export interface BusinessContext {
    name: string
    abn?: string
    industry?: string
    financialYear: string
}

export interface ForensicAnalysis {
    transactionId: string

    // Category Analysis
    categories: {
        primary: string
        secondary: string[]
        confidence: number // 0-100
    }

    // R&D Assessment (Division 355)
    rndAssessment: {
        isRndCandidate: boolean
        meetsDiv355Criteria: boolean
        activityType: 'core_rnd' | 'supporting_rnd' | 'not_eligible'
        confidence: number
        reasoning: string

        // Four-element test
        fourElementTest: {
            outcomeUnknown: { met: boolean; confidence: number; evidence: string[] }
            systematicApproach: { met: boolean; confidence: number; evidence: string[] }
            newKnowledge: { met: boolean; confidence: number; evidence: string[] }
            scientificMethod: { met: boolean; confidence: number; evidence: string[] }
        }
    }

    // Deduction Eligibility (Division 8)
    deductionEligibility: {
        isFullyDeductible: boolean
        deductionType: string
        claimableAmount: number
        restrictions: string[]
        confidence: number
    }

    // Compliance Flags
    complianceFlags: {
        requiresDocumentation: boolean
        fbtImplications: boolean
        division7aRisk: boolean
        notes: string[]
    }
}

// Prompts
const FORENSIC_ANALYSIS_PROMPT = `You are a forensic tax accountant from a Big 4 accounting firm analyzing Australian business transactions for tax optimization.

Analyze this transaction and provide a structured JSON response with:

1. **Category Classification**
   - Primary category (e.g., R&D, Marketing, Professional Services, Software, Hardware, Consulting, Travel, etc.)
   - Secondary categories (additional applicable categories)
   - Confidence level (0-100%)

2. **R&D Tax Incentive Assessment (Division 355 ITAA 1997)**
   Assess against the four-element test:
   a) **Outcome Unknown**: Could the outcome be known in advance by a competent professional?
   b) **Systematic Approach**: Is it planned and executed in a systematic manner?
   c) **New Knowledge**: Does it generate new knowledge (not routine application)?
   d) **Scientific Method**: Is it based on principles of established sciences?

   For each element, provide:
   - met: boolean
   - confidence: 0-100
   - evidence: array of specific text from transaction supporting the assessment

   Determine:
   - isRndCandidate: boolean (does it look like R&D?)
   - meetsDiv355Criteria: boolean (all four elements TRUE?)
   - activityType: 'core_rnd' | 'supporting_rnd' | 'not_eligible'
   - reasoning: specific explanation

3. **General Deduction Eligibility (Division 8 ITAA 1997)**
   - Is it fully deductible for tax purposes?
   - Deduction type (e.g., 'Section 8-1', 'Division 40 depreciation', 'Instant write-off')
   - Claimable amount (may differ from total if private use)
   - Restrictions (e.g., 'Private use component', 'Entertainment limitation', 'Capital nature')
   - Confidence level (0-100%)

4. **Compliance Considerations**
   - Requires additional documentation? (receipts, contracts, timesheets)
   - FBT implications? (fringe benefits tax)
   - Division 7A risk? (shareholder loan/payment)
   - Compliance notes

**Transaction Details:**
- Description: {description}
- Amount: {amount}
- Supplier: {supplier}
- Date: {date}
- Account Code: {accountCode}
- Line Items: {lineItems}

**Business Context:**
- Business: {businessName} (ABN: {abn})
- Industry: {industry}
- Financial Year: {financialYear}

**Important Rules:**
- For R&D assessment, mark isRndCandidate=true ONLY when the transaction description or context contains specific evidence of:
  * Technical uncertainty that could not be determined in advance
  * Systematic investigation or experimentation
  * Generation of new knowledge not available in the public domain
  * Activities based on principles of established science

  Do NOT flag as R&D: routine software development, standard IT operations, cloud hosting/infrastructure, general consulting, or any activity where the outcome was known or determinable in advance.

  The R&D Tax Incentive (Division 355 ITAA 1997) requires genuine technical uncertainty and systematic investigation. Routine activities do not qualify.

- The four-element test must be assessed with rigour. Only mark an element as met if there is clear, specific evidence in the transaction description. Low-confidence assumptions do not satisfy the test.
- Confidence scores should reflect certainty (60-70% = possible candidate, 70-80% = probable candidate, 80-90% = strong candidate, 90-100% = very strong candidate)

- **Special Tax Categories** - When classifying, apply these specific rules:
  * Entertainment/meals: Flag with note "50% deductible under FBTAA 1986, s 32-5"
  * Vehicle/motor vehicle: Flag with note "Deductible via cents per km (85c/km max 5,000km) or logbook method"
  * Home office: Flag with note "Deductible via fixed rate (67c/hour) or actual cost method"
  * Gifts and donations: Flag with note "Deductible only if recipient has DGR status, minimum $2"
  * Training/self-education: Flag with note "Must relate to current income-earning activity"
  * Superannuation: Flag with note "Check contribution caps and employer obligations"
  * FBT-liable benefits: Flag with note "May trigger Fringe Benefits Tax at 47%"

- For each finding, you MUST:
  1. Cite the specific legislative provision that makes this expense deductible or non-deductible (e.g., 's 8-1 ITAA 1997 - general deduction', 's 355-25 ITAA 1997 - core R&D activity')
  2. Quote the specific words or phrases from the transaction description that triggered your classification
  3. Explain WHY this transaction falls under that provision

- Evidence must be specific quotes or references from the transaction description with legislative context
- For deductions, assume Section 8-1 unless specific legislation applies
- Flag entertainment expenses (meals, events) as requiring scrutiny

**Output Format:**
Return ONLY valid JSON matching this structure (no markdown, no explanations outside JSON):

{
  "categories": {
    "primary": "string",
    "secondary": ["string"],
    "confidence": number
  },
  "rndAssessment": {
    "isRndCandidate": boolean,
    "meetsDiv355Criteria": boolean,
    "activityType": "core_rnd" | "supporting_rnd" | "not_eligible",
    "confidence": number,
    "reasoning": "string",
    "fourElementTest": {
      "outcomeUnknown": { "met": boolean, "confidence": number, "evidence": ["string"] },
      "systematicApproach": { "met": boolean, "confidence": number, "evidence": ["string"] },
      "newKnowledge": { "met": boolean, "confidence": number, "evidence": ["string"] },
      "scientificMethod": { "met": boolean, "confidence": number, "evidence": ["string"] }
    }
  },
  "deductionEligibility": {
    "isFullyDeductible": boolean,
    "deductionType": "string",
    "claimableAmount": number,
    "restrictions": ["string"],
    "confidence": number
  },
  "complianceFlags": {
    "requiresDocumentation": boolean,
    "fbtImplications": boolean,
    "division7aRisk": boolean,
    "notes": ["string"]
  }
}
`

/**
 * Analyze a single transaction with Google AI
 */
export async function analyzeTransaction(
    transaction: TransactionContext,
    business: BusinessContext
): Promise<ForensicAnalysis> {
    try {
        // Anonymise supplier name before sending to Gemini (APP 8 data minimisation)
        const anonymiser = createSupplierAnonymiser()
        const anonymisedSupplier = anonymiser.anonymise(transaction.supplier)

        // Prepare prompt with transaction details
        const prompt = FORENSIC_ANALYSIS_PROMPT
            .replace('{description}', transaction.description || 'No description')
            .replace('{amount}', transaction.amount.toString())
            .replace('{supplier}', anonymisedSupplier)
            .replace('{date}', transaction.date)
            .replace('{accountCode}', transaction.accountCode || 'N/A')
            .replace('{lineItems}', JSON.stringify(transaction.lineItems || [], null, 2))
            .replace('{businessName}', business.name)
            .replace('{abn}', business.abn || 'N/A')
            .replace('{industry}', business.industry || 'N/A')
            .replace('{financialYear}', business.financialYear)

        // Call Google AI (Gemini 2.0 Flash Exp - FREE and Available)
        const model = getGoogleAI().getGenerativeModel({
            model: 'gemini-2.0-flash', // Using available free model
            generationConfig: {
                temperature: 0.1, // Ultra-low temperature for maximum consistency and accuracy
                maxOutputTokens: 8000, // Detailed analysis with comprehensive reasoning
            }
        })

        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        // Parse JSON response
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const analysis = JSON.parse(cleanedText)

        // Map to our format
        return {
            transactionId: transaction.transactionID,
            categories: analysis.categories,
            rndAssessment: analysis.rndAssessment,
            deductionEligibility: analysis.deductionEligibility,
            complianceFlags: analysis.complianceFlags,
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ CRITICAL: AI analysis failed for transaction ${transaction.transactionID}:`, error)

        // Check if it's a model configuration error
        if (errorMessage.includes('model') || errorMessage.includes('not found') || errorMessage.includes('404')) {
            console.error('🚨 AI MODEL ERROR: The configured model does not exist or is not accessible!')
            console.error('Current model: gemini-3-pro-preview')
            console.error('Available models: gemini-3-pro-preview, gemini-2.0-flash, gemini-1.5-pro')
            console.error('Please verify GOOGLE_AI_API_KEY is valid and model name is correct')
        }

        // Check if it's an API key error
        if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
            console.error('🔑 API KEY ERROR: Google AI API key is invalid or missing!')
            console.error('Please check GOOGLE_AI_API_KEY environment variable')
        }

        // Don't hide the error - throw it so batch processor can handle it properly
        throw new Error(`AI analysis failed for transaction ${transaction.transactionID}: ${errorMessage}`)
    }
}

/**
 * Analyze multiple transactions in batch
 * Processes transactions sequentially to avoid rate limits
 */
export async function analyzeTransactionBatch(
    transactions: TransactionContext[],
    business: BusinessContext,
    onProgress?: (completed: number, total: number) => void
): Promise<ForensicAnalysis[]> {
    const results: ForensicAnalysis[] = []

    for (let i = 0; i < transactions.length; i++) {
        const analysis = await analyzeTransaction(transactions[i], business)
        results.push(analysis)

        if (onProgress) {
            onProgress(i + 1, transactions.length)
        }

        // Delay to respect rate limits (Gemini 2.0 Flash Exp free tier: 15 requests/minute)
        if (i < transactions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 4000)) // 4 second delay = 15 RPM
        }
    }

    return results
}

/**
 * Calculate cost estimate for analyzing transactions
 */
export function estimateAnalysisCost(transactionCount: number): {
    inputTokens: number
    outputTokens: number
    estimatedCostUSD: number
} {
    // Gemini 1.5 Flash pricing (as of 2024):
    // Input: $0.075 per 1M tokens
    // Output: $0.30 per 1M tokens

    const avgInputTokensPerTransaction = 800 // Prompt + transaction details
    const avgOutputTokensPerTransaction = 1000 // JSON response

    const totalInputTokens = transactionCount * avgInputTokensPerTransaction
    const totalOutputTokens = transactionCount * avgOutputTokensPerTransaction

    const inputCost = (totalInputTokens / 1_000_000) * 0.075
    const outputCost = (totalOutputTokens / 1_000_000) * 0.30

    return {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCostUSD: inputCost + outputCost
    }
}

/**
 * Get model information (Gemini 3 Pro - Maximum Accuracy)
 */
export function getModelInfo() {
    return {
        model: 'gemini-3-pro-preview',
        provider: 'Google AI (Gemini 3 Pro)',
        description: 'Most Intelligent Model: Maximum accuracy for forensic tax analysis',
        version: 'Gemini 3 Pro Preview (January 2026)',
        tier: 'Premium - Maximum Accuracy',
        temperature: 0.1, // Ultra-low for maximum accuracy
        maxInputTokens: 1048576, // 1M tokens
        maxOutputTokens: 8000, // 8K tokens
        capabilities: ['Text', 'Image', 'Video', 'Audio', 'PDF', 'Function Calling', 'Search Grounding', 'Code Execution', 'Advanced Reasoning', 'Native Multimodal', 'Deep Analysis'],
        rateLimit: '60 requests/minute',
        // Gemini 3 Pro pricing
        costPer1MInputTokens: 0.15, // Premium tier
        costPer1MOutputTokens: 0.60, // Premium tier
    }
}
