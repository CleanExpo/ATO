/**
 * AI-Powered Account Classifier
 *
 * Uses Google Gemini AI to detect miscategorized transactions by analyzing:
 * - Transaction description + supplier name + amount
 * - Current account code assignment
 * - Chart of accounts structure
 * - Industry-specific patterns
 * - Historical patterns for similar transactions
 *
 * Only auto-fixes if confidence > 90%
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'
import { createSupplierAnonymiser } from './pii-sanitizer'

// Initialize Google AI
const genAI = new GoogleGenerativeAI(optionalConfig.googleAiApiKey)

// Types
export interface Transaction {
    transactionId: string
    date: string
    description: string
    supplier?: string
    amount: number
    currentAccountCode: string
    currentAccountName: string
    taxType?: string
    lineItems?: Array<{
        description?: string
        accountCode?: string
        amount?: number
    }>
}

export interface AccountCodeOption {
    code: string
    name: string
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'other'
    description?: string
}

export interface ClassificationResult {
    isCorrect: boolean
    confidence: number // 0-100
    suggestedAccountCode?: string
    suggestedAccountName?: string
    reasoning: string
    impactType: 'pl' | 'balance_sheet' | 'both' | 'none'  // P&L, Balance Sheet, or both
    severity: 'critical' | 'high' | 'medium' | 'low'
    examples: string[]  // Similar transactions that support this classification
}

export interface ClassificationContext {
    chartOfAccounts: AccountCodeOption[]
    similarTransactions?: Array<{
        description: string
        supplier?: string
        accountCode: string
        accountName: string
    }>
    industryContext?: string
}

const ACCOUNT_CLASSIFICATION_PROMPT = `You are a forensic accountant reviewing Australian business transactions for proper account classification.

Analyze this transaction and determine if it's in the CORRECT account.

**Transaction:**
- Description: {description}
- Supplier: {supplier}
- Amount: {amount}
- Current Account: {currentAccountCode} ({currentAccountName})
- Tax Type: {taxType}
- Date: {date}

**Line Items:**
{lineItems}

**Chart of Accounts:**
{chartOfAccounts}

**Similar Historical Transactions:**
{similarTransactions}

**Industry Context:** {industryContext}

**Your Task:**
1. **Is this transaction in the CORRECT account?** (Yes/No)
2. **If No, what is the CORRECT account code?** (from the chart of accounts provided)
3. **Confidence level** (0-100%) - Be conservative. Only high confidence (>90%) will trigger auto-correction.
4. **Reasoning** - Explain why current is wrong and why suggested is correct
5. **Impact** - Does this affect P&L, Balance Sheet, or Tax calculations?
6. **Severity** - critical (>$10k), high (>$5k), medium (>$1k), low (<$1k)

**Common Miscategorizations to Catch:**

1. **Expenses coded as Assets:**
   - Office supplies → Should be "Office Expenses" not "Fixed Assets"
   - Software subscriptions → Should be "Software Expenses" not "Computer Equipment"

2. **Capital purchases coded as Expenses:**
   - Equipment >$20k → Should be "Fixed Assets" (depreciated) not "Repairs & Maintenance"
   - Computers → Should be "Computer Equipment" if >$300

3. **Loan repayments coded incorrectly:**
   - Full payment as "Interest Expense" → Should split: "Loan Payable" (principal) + "Interest Expense" (interest)

4. **Personal expenses in business accounts:**
   - Personal fuel/groceries → Flag as "Private Use" or "Drawings"

5. **Incorrect expense categories:**
   - Website hosting → Should be "Website & IT Costs" not "Advertising"
   - Bank fees → Should be "Bank Fees" not "General Expenses"

6. **Revenue misclassification:**
   - Loan proceeds → Should be "Loan - Bank" not "Sales Revenue"
   - Asset sales → Should be "Asset Sale Proceeds" not "Sales Revenue"

**Return JSON:**
{
  "isCorrect": boolean,
  "confidence": number (0-100),
  "suggestedAccountCode": string | null,
  "suggestedAccountName": string | null,
  "reasoning": string,
  "impactType": "pl" | "balance_sheet" | "both" | "none",
  "severity": "critical" | "high" | "medium" | "low",
  "examples": string[]
}

**Important:** Be conservative with confidence scores. If unsure, keep confidence below 70% so it gets flagged for human review.`;

/**
 * Classify a single transaction using AI
 */
export async function classifyTransaction(
    transaction: Transaction,
    context: ClassificationContext
): Promise<ClassificationResult> {
    try {
        // Anonymise supplier names before sending to Gemini (APP 8 data minimisation)
        const anonymiser = createSupplierAnonymiser()

        // Prepare prompt with transaction data
        const lineItemsText = transaction.lineItems
            ?.map((item, idx) =>
                `  ${idx + 1}. ${item.description || 'No description'} - ${item.accountCode || 'No account'} - $${item.amount || 0}`
            )
            .join('\n') || 'No line items';

        const chartText = context.chartOfAccounts
            .map(acc => `- ${acc.code}: ${acc.name} (${acc.type})`)
            .join('\n');

        const similarText = context.similarTransactions
            ?.map(txn =>
                `- "${txn.description}" from ${anonymiser.anonymise(txn.supplier)} → ${txn.accountCode} (${txn.accountName})`
            )
            .join('\n') || 'No historical transactions available';

        const prompt = ACCOUNT_CLASSIFICATION_PROMPT
            .replace('{description}', transaction.description || 'No description')
            .replace('{supplier}', anonymiser.anonymise(transaction.supplier))
            .replace('{amount}', transaction.amount.toFixed(2))
            .replace('{currentAccountCode}', transaction.currentAccountCode)
            .replace('{currentAccountName}', transaction.currentAccountName)
            .replace('{taxType}', transaction.taxType || 'Not specified')
            .replace('{date}', transaction.date)
            .replace('{lineItems}', lineItemsText)
            .replace('{chartOfAccounts}', chartText)
            .replace('{similarTransactions}', similarText)
            .replace('{industryContext}', context.industryContext || 'General business');

        // Call Gemini API (using LATEST Gemini 2.0 Flash Exp - FREE)
        const model = genAI.getGenerativeModel({
            model: optionalConfig.googleAiModel,
            generationConfig: {
                temperature: 0.1,  // Low temperature for consistent, deterministic results
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        // Extract JSON from markdown code blocks if present
        let jsonText = text;
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        }

        const classification = JSON.parse(jsonText) as ClassificationResult;

        // Validate confidence range
        if (classification.confidence < 0) classification.confidence = 0;
        if (classification.confidence > 100) classification.confidence = 100;

        // Ensure examples array exists
        if (!classification.examples) classification.examples = [];

        return classification;

    } catch (error) {
        console.error('Error classifying transaction:', error);

        // Return error state - never default to "correct" on failure
        return {
            isCorrect: false,
            confidence: 0,
            reasoning: `Classification failed due to AI processing error. Manual review required. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            impactType: 'none',
            severity: 'medium',
            examples: []
        };
    }
}

/**
 * Batch classify multiple transactions for efficiency
 */
export async function classifyTransactionBatch(
    transactions: Transaction[],
    context: ClassificationContext,
    onProgress?: (processed: number, total: number) => void
): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    // Process transactions sequentially (could parallelize with rate limiting)
    for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];

        try {
            const result = await classifyTransaction(transaction, context);
            results.set(transaction.transactionId, result);

            if (onProgress) {
                onProgress(i + 1, transactions.length);
            }

            // Small delay to avoid rate limiting
            if (i < transactions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));  // 500ms delay
            }
        } catch (error) {
            console.error(`Failed to classify transaction ${transaction.transactionId}:`, error);

            // Store error result - never default to "correct" on failure
            results.set(transaction.transactionId, {
                isCorrect: false,
                confidence: 0,
                reasoning: `Classification failed due to AI processing error. Manual review required. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                impactType: 'none',
                severity: 'medium',
                examples: []
            });
        }
    }

    return results;
}

/**
 * Get suggested account code based on transaction description and supplier
 * This is a simplified version for quick suggestions without full AI analysis
 */
export function getQuickSuggestion(
    description: string,
    supplier: string | undefined,
    chartOfAccounts: AccountCodeOption[]
): AccountCodeOption | null {
    const desc = description.toLowerCase();
    const supp = (supplier || '').toLowerCase();

    // Common patterns
    const patterns: Record<string, string[]> = {
        'office': ['stationery', 'office', 'supplies', 'paper'],
        'software': ['software', 'saas', 'subscription', 'cloud', 'app'],
        'advertising': ['google ads', 'facebook', 'marketing', 'advertising', 'promotion'],
        'bank fees': ['bank fee', 'account fee', 'transaction fee', 'service charge'],
        'interest': ['interest', 'loan interest', 'finance charge'],
        'rent': ['rent', 'lease', 'premises'],
        'utilities': ['electricity', 'gas', 'water', 'utilities', 'power'],
        'telephone': ['phone', 'mobile', 'telephone', 'telstra', 'optus'],
        'insurance': ['insurance', 'policy', 'premium'],
        'legal': ['legal', 'lawyer', 'solicitor', 'attorney'],
        'accounting': ['accountant', 'bookkeep', 'tax agent', 'bdo', 'pwc', 'ey', 'kpmg', 'deloitte'],
    };

    // Find matching account
    for (const [accountType, keywords] of Object.entries(patterns)) {
        if (keywords.some(kw => desc.includes(kw) || supp.includes(kw))) {
            // Find account in chart that matches this type
            const account = chartOfAccounts.find(acc =>
                acc.name.toLowerCase().includes(accountType) ||
                acc.description?.toLowerCase().includes(accountType)
            );

            if (account) {
                return account;
            }
        }
    }

    return null;
}

/**
 * Estimate confidence based on similarity to historical transactions
 */
export function estimateConfidenceFromHistory(
    transaction: Transaction,
    similarTransactions: Array<{ description: string; supplier?: string; accountCode: string }>
): number {
    if (!similarTransactions || similarTransactions.length === 0) {
        return 50;  // Medium confidence with no history
    }

    // Count how many similar transactions use the same account code
    const sameAccountCount = similarTransactions.filter(
        txn => txn.accountCode === transaction.currentAccountCode
    ).length;

    const matchPercentage = (sameAccountCount / similarTransactions.length) * 100;

    // High confidence if >80% of similar transactions use same account
    if (matchPercentage >= 80) return 90;
    if (matchPercentage >= 60) return 75;
    if (matchPercentage >= 40) return 60;
    return 40;  // Low confidence if few similar transactions match
}
