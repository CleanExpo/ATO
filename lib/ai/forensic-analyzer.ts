/**
 * AI Forensic Analyzer
 *
 * Deep analysis of transactions using multiple AI providers for tax optimization.
 *
 * Providers:
 * - Google Gemini (4 fast models in round-robin)
 * - OpenRouter (Grok, DeepSeek, etc. via OpenAI-compatible API)
 *
 * Features:
 * - Division 355 (R&D) assessment with four-element test
 * - Division 8 (General deductions) eligibility
 * - Compliance flags (FBT, Division 7A)
 * - Confidence scoring (0-100%)
 * - Batch processing with multi-provider concurrency
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'
import { createSupplierAnonymiser } from './pii-sanitizer'
import { withRateLimitRetry, rateLimitTracker } from './rate-limiter'

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

/**
 * Multi-provider model pool for round-robin across all available AI endpoints.
 * Fastest models first for maximum throughput.
 */
interface ModelEntry {
    provider: 'gemini' | 'openrouter'
    model: string
    label: string // For logging
}

function buildModelPool(): ModelEntry[] {
    const pool: ModelEntry[] = []

    // Gemini models (always available if GOOGLE_AI_API_KEY is set)
    if (optionalConfig.googleAiApiKey) {
        pool.push(
            { provider: 'gemini', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (~0.9s)' },
            { provider: 'gemini', model: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (~1.1s)' },
            { provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (~4.5s)' },
            { provider: 'gemini', model: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (~6.3s)' },
        )
    }

    // OpenRouter models (available if OPENROUTER_API_KEY is set)
    if (optionalConfig.openRouterApiKey) {
        pool.push(
            { provider: 'openrouter', model: 'x-ai/grok-code-fast-1', label: 'Grok Code Fast 1 (335 tok/s)' },
        )
    }

    return pool
}

let cachedModelPool: ModelEntry[] | null = null
function getModelPool(): ModelEntry[] {
    if (!cachedModelPool) {
        cachedModelPool = buildModelPool()
    }
    return cachedModelPool
}

let modelIndex = 0

function getNextModel(): ModelEntry {
    const pool = getModelPool()
    if (pool.length === 0) {
        throw new Error('No AI models available. Set GOOGLE_AI_API_KEY or OPENROUTER_API_KEY.')
    }
    const entry = pool[modelIndex % pool.length]
    modelIndex++
    return entry
}

/**
 * Call OpenRouter API (OpenAI-compatible) for text generation.
 */
async function callOpenRouter(model: string, prompt: string): Promise<string> {
    const apiKey = optionalConfig.openRouterApiKey
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ato-ai.app',
            'X-Title': 'ATO Tax Optimizer',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 8000,
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter API error (${response.status}): ${errText.slice(0, 200)}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
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
 * Analyze a single transaction using the next model in the multi-provider pool.
 * Includes rate limit retry logic with exponential backoff.
 */
export async function analyzeTransaction(
    transaction: TransactionContext,
    business: BusinessContext
): Promise<ForensicAnalysis> {
    return withRateLimitRetry(async () => {
        // Anonymise supplier name before sending to AI (APP 8 data minimisation)
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

        // Round-robin across all available models (Gemini + OpenRouter)
        const modelEntry = getNextModel()
        let text: string

        // Check rate limit status before making request
        await rateLimitTracker.waitIfNeeded(modelEntry.provider)

        if (modelEntry.provider === 'gemini') {
            const model = getGoogleAI().getGenerativeModel({
                model: modelEntry.model,
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8000,
                }
            })
            const result = await model.generateContent(prompt)
            text = result.response.text()
        } else {
            // OpenRouter (OpenAI-compatible)
            text = await callOpenRouter(modelEntry.model, prompt)
        }

        // Parse JSON response (strip markdown fences if present)
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const analysis = JSON.parse(cleanedText)

        return {
            transactionId: transaction.transactionID,
            categories: analysis.categories,
            rndAssessment: analysis.rndAssessment,
            deductionEligibility: analysis.deductionEligibility,
            complianceFlags: analysis.complianceFlags,
        }
    }, `analyzeTransaction-${transaction.transactionID}`, {
        maxAttempts: 5,
        initialDelayMs: 2000, // Start with 2s delay for AI APIs
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        jitter: true,
    })
}

/**
 * Analyze multiple transactions in batch
 * Processes transactions with controlled concurrency for throughput
 */
export async function analyzeTransactionBatch(
    transactions: TransactionContext[],
    business: BusinessContext,
    onProgress?: (completed: number, total: number) => void
): Promise<ForensicAnalysis[]> {
    const CONCURRENCY = 5 // 5 parallel Gemini calls
    const results: ForensicAnalysis[] = new Array(transactions.length)
    let completed = 0

    // Process in concurrent chunks
    for (let i = 0; i < transactions.length; i += CONCURRENCY) {
        const chunk = transactions.slice(i, i + CONCURRENCY)
        const chunkResults = await Promise.allSettled(
            chunk.map((txn, idx) => analyzeTransaction(txn, business).then(result => {
                results[i + idx] = result
                completed++
                if (onProgress) onProgress(completed, transactions.length)
                return result
            }))
        )

        // Handle any failures gracefully - use fallback for failed analyses
        for (let j = 0; j < chunkResults.length; j++) {
            if (chunkResults[j].status === 'rejected') {
                const reason = (chunkResults[j] as PromiseRejectedResult).reason
                console.error(`Transaction analysis failed (index ${i + j}):`, reason?.message || reason)
                // Still count as completed
                if (!results[i + j]) {
                    completed++
                    if (onProgress) onProgress(completed, transactions.length)
                }
            }
        }
    }

    // Filter out any undefined slots from failed analyses
    return results.filter(Boolean)
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
 * Get model pool information for diagnostics
 */
export function getModelInfo() {
    const pool = getModelPool()
    return {
        mode: 'multi-provider-round-robin',
        activeModels: pool.map(m => ({ provider: m.provider, model: m.model, label: m.label })),
        totalModels: pool.length,
        concurrency: 5,
        temperature: 0.1,
        maxOutputTokens: 8000,
    }
}
