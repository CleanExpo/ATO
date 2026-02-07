/**
 * Gemini AI Mock Data Factory
 *
 * Generates realistic Gemini API responses for testing forensic analysis
 * without consuming API quota or hitting rate limits.
 */

import { faker } from '@faker-js/faker'

// Set seed for reproducible tests
faker.seed(12345)

export class GeminiMockFactory {
  /**
   * Generate mock forensic analysis response for a transaction
   */
  static forensicAnalysis(transaction: any) {
    const description = transaction.description || transaction.lineItems?.[0]?.description || ''
    const amount = transaction.total || transaction.lineItems?.[0]?.lineAmount || 0

    // Determine if this looks like R&D based on description
    const isRndCandidate = description.toLowerCase().includes('r&d') ||
                          description.toLowerCase().includes('research') ||
                          description.toLowerCase().includes('development') ||
                          description.toLowerCase().includes('experimental') ||
                          description.toLowerCase().includes('prototype')

    // Determine if this looks like Division 7A based on description
    const isDiv7aCandidate = description.toLowerCase().includes('loan') ||
                            description.toLowerCase().includes('shareholder') ||
                            description.toLowerCase().includes('director') ||
                            description.toLowerCase().includes('distribution')

    const category = this.determineTaxCategory(isRndCandidate, isDiv7aCandidate, amount)

    return {
      transaction_id: transaction.transactionID || transaction.id,
      analysis: {
        tax_category: category,
        confidence: this.calculateConfidence(category, description),
        reasoning: this.generateReasoning(transaction, category),
        legislative_references: this.getLegislativeRefs(category),
        recommendations: this.generateRecommendations(category),
        potential_savings: this.estimateSavings(category, amount),
        flags: this.generateFlags(category, amount),
      },
      metadata: {
        analyzed_at: new Date().toISOString(),
        model: 'gemini-2.0-flash-exp',
        processing_time_ms: faker.number.int({ min: 500, max: 2000 }),
      },
    }
  }

  /**
   * Generate batch analysis response (multiple transactions)
   */
  static batchAnalysis(transactions: any[], batchSize: number = 50) {
    const batch = transactions.slice(0, batchSize)

    return {
      batch_id: faker.string.uuid(),
      batch_size: batch.length,
      results: batch.map(tx => this.forensicAnalysis(tx)),
      summary: {
        total_analyzed: batch.length,
        rnd_candidates: batch.filter(tx =>
          tx.description?.toLowerCase().includes('r&d')
        ).length,
        division_7a_candidates: batch.filter(tx =>
          tx.description?.toLowerCase().includes('loan')
        ).length,
        deduction_opportunities: faker.number.int({ min: 5, max: 20 }),
        estimated_total_savings: faker.number.float({ min: 10000, max: 100000, fractionDigits: 2 }),
      },
      metadata: {
        processed_at: new Date().toISOString(),
        processing_time_ms: faker.number.int({ min: 5000, max: 30000 }),
      },
    }
  }

  /**
   * Generate mock Gemini API error
   */
  static error(type: 'rate_limit' | 'invalid_api_key' | 'content_filter' | 'server_error') {
    const errors = {
      rate_limit: {
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'RATE_LIMIT_EXCEEDED',
              domain: 'googleapis.com',
              metadata: {
                quota_limit: 'GenerateContentRequestsPerMinutePerProjectPerRegion',
                quota_limit_value: '15',
                consumer: 'projects/test-project',
              },
            },
          ],
        },
      },
      invalid_api_key: {
        error: {
          code: 401,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'UNAUTHENTICATED',
        },
      },
      content_filter: {
        error: {
          code: 400,
          message: 'The response was blocked due to content filtering.',
          status: 'INVALID_ARGUMENT',
        },
      },
      server_error: {
        error: {
          code: 500,
          message: 'Internal error encountered.',
          status: 'INTERNAL',
        },
      },
    }

    return errors[type]
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  private static determineTaxCategory(
    isRnd: boolean,
    isDiv7a: boolean,
    amount: number
  ): string {
    if (isRnd && Math.random() > 0.3) {
      return 'R&D_TAX_INCENTIVE'
    }

    if (isDiv7a && Math.random() > 0.4) {
      return 'DIVISION_7A'
    }

    if (amount > 20000 && Math.random() > 0.6) {
      return 'INSTANT_ASSET_WRITEOFF'
    }

    const categories = [
      'GENERAL_DEDUCTION',
      'CAPITAL_EXPENSE',
      'NON_DEDUCTIBLE',
      'PRIVATE_USE',
      'PREPAYMENT',
      'BAD_DEBT',
    ]

    return faker.helpers.arrayElement(categories)
  }

  private static calculateConfidence(category: string, description: string): number {
    // Higher confidence for clear indicators
    if (category === 'R&D_TAX_INCENTIVE' && description.toLowerCase().includes('experimental')) {
      return faker.number.float({ min: 85, max: 95, fractionDigits: 1 })
    }

    if (category === 'DIVISION_7A' && description.toLowerCase().includes('shareholder')) {
      return faker.number.float({ min: 80, max: 90, fractionDigits: 1 })
    }

    // Medium confidence for general deductions
    if (category === 'GENERAL_DEDUCTION') {
      return faker.number.float({ min: 70, max: 85, fractionDigits: 1 })
    }

    // Lower confidence for uncertain classifications
    return faker.number.float({ min: 60, max: 75, fractionDigits: 1 })
  }

  private static generateReasoning(transaction: any, category: string): string {
    const description = transaction.description || transaction.lineItems?.[0]?.description || 'Transaction'
    const supplier = transaction.contact?.name || 'supplier'
    const amount = transaction.total || transaction.lineItems?.[0]?.lineAmount || 0
    const accountCode = transaction.lineItems?.[0]?.accountCode || 'unknown'

    const reasoningTemplates: Record<string, string> = {
      'R&D_TAX_INCENTIVE': `Transaction for "${description}" to ${supplier} appears to involve research and development activities. The description includes keywords suggesting experimental or innovative work, which may be eligible for the R&D Tax Incentive under Division 355 ITAA 1997. Further assessment against the four-element test is recommended.`,
      'DIVISION_7A': `Payment of $${amount.toFixed(2)} for "${description}" may constitute a Division 7A loan to a shareholder or associate. This requires verification that the transaction meets benchmark interest rate requirements (8.77% for FY2024-25) and minimum repayment terms. Non-compliance could result in deemed dividend treatment.`,
      'INSTANT_ASSET_WRITEOFF': `Purchase of "${description}" for $${amount.toFixed(2)} may qualify for instant asset write-off under Subdivision 328-D. Asset value exceeds the $20,000 threshold, requiring depreciation schedule unless business qualifies for small business concessions.`,
      'GENERAL_DEDUCTION': `Expense for "${description}" to ${supplier} appears to be incurred in producing assessable income. Deductible under Section 8-1 ITAA 1997 subject to verification of business purpose and that the expense is not capital in nature.`,
      'CAPITAL_EXPENSE': `Transaction categorized under account code ${accountCode} suggests capital expenditure. This may require capitalization and depreciation rather than immediate deduction. Assessment needed to determine if any concessions apply.`,
      'NON_DEDUCTIBLE': `Expense for "${description}" may not satisfy Section 8-1 requirements. Further investigation needed to determine if expense was incurred in producing assessable income or if private use apportionment applies.`,
      'PRIVATE_USE': `Transaction may involve both business and private use components. Section 8-1 requires apportionment calculation to determine deductible portion. Documentation of business use percentage is essential.`,
      'PREPAYMENT': `Payment of $${amount.toFixed(2)} for "${description}" may be a prepayment requiring special consideration under Section 82KZM. Deductibility may be spread across multiple income years.`,
      'BAD_DEBT': `Transaction for "${description}" may represent a bad debt write-off. Eligibility for deduction under Section 25-35 requires verification that debt was previously included in assessable income and genuine attempts at recovery were made.`,
    }

    return reasoningTemplates[category] ||
           `Transaction for "${description}" requires further analysis to determine appropriate tax treatment.`
  }

  private static getLegislativeRefs(category: string): string[] {
    const references: Record<string, string[]> = {
      'R&D_TAX_INCENTIVE': [
        'Division 355 ITAA 1997',
        'Section 355-25 ITAA 1997 (R&D activities)',
        'Section 355-30 ITAA 1997 (supporting R&D activities)',
        'Section 355-100 ITAA 1997 (tax offset)',
      ],
      'DIVISION_7A': [
        'Division 7A ITAA 1936',
        'Section 109N ITAA 1936 (benchmark interest rate)',
        'Section 109E ITAA 1936 (payments)',
        'Section 109F ITAA 1936 (loans)',
      ],
      'INSTANT_ASSET_WRITEOFF': [
        'Subdivision 328-D ITAA 1997',
        'Section 328-180 ITAA 1997 (instant asset write-off)',
        'Section 328-185 ITAA 1997 (cost threshold)',
      ],
      'GENERAL_DEDUCTION': [
        'Section 8-1 ITAA 1997 (general deductions)',
        'Division 8 ITAA 1997',
      ],
      'CAPITAL_EXPENSE': [
        'Section 8-1 ITAA 1997',
        'Division 40 ITAA 1997 (capital allowances)',
        'Subdivision 40-B ITAA 1997 (depreciating assets)',
      ],
      'BAD_DEBT': [
        'Section 25-35 ITAA 1997 (bad debts)',
        'Section 8-1 ITAA 1997',
      ],
    }

    return references[category] || ['Section 8-1 ITAA 1997']
  }

  private static generateRecommendations(category: string): string[] {
    const recommendations: Record<string, string[]> = {
      'R&D_TAX_INCENTIVE': [
        'Verify activity meets all four elements of R&D definition',
        'Document systematic approach and hypothesis testing',
        'Confirm outcome could not be determined in advance',
        'Register R&D activities within 10 months of FY end',
        'Engage R&D consultant for compliance review',
      ],
      'DIVISION_7A': [
        'Verify loan agreement documentation exists',
        'Calculate benchmark interest rate (8.77% for FY2024-25)',
        'Confirm minimum yearly repayments being made',
        'Review whether loan should be converted to Division 7A compliant terms',
        'Consider dividend declaration to clear loan account',
      ],
      'INSTANT_ASSET_WRITEOFF': [
        'Confirm asset first used or installed ready for use in income year',
        'Verify business aggregated turnover under $10 million',
        'Check asset cost does not exceed $20,000',
        'Ensure asset is used predominantly in business activities',
      ],
      'GENERAL_DEDUCTION': [
        'Verify expense incurred in producing assessable income',
        'Confirm expense not capital in nature',
        'Check for private use and apply apportionment if needed',
        'Ensure expense not specifically excluded by legislation',
        'Retain tax invoices and supporting documentation',
      ],
      'CAPITAL_EXPENSE': [
        'Calculate depreciation under Division 40',
        'Determine asset effective life',
        'Check eligibility for accelerated depreciation',
        'Review small business instant asset write-off eligibility',
      ],
      'BAD_DEBT': [
        'Confirm debt previously included in assessable income',
        'Document recovery attempts made',
        'Write off debt formally in company records',
        'Consider commercial debt forgiveness rules',
      ],
    }

    const defaultRecommendations = [
      'Review transaction documentation',
      'Confirm tax treatment with qualified tax advisor',
      'Maintain contemporaneous records',
    ]

    const recs = recommendations[category] || defaultRecommendations
    return faker.helpers.arrayElements(recs, faker.number.int({ min: 2, max: Math.min(4, recs.length) }))
  }

  private static estimateSavings(category: string, amount: number): number | null {
    switch (category) {
      case 'R&D_TAX_INCENTIVE':
        // 43.5% offset for small business
        return amount * 0.435

      case 'INSTANT_ASSET_WRITEOFF':
        // Immediate deduction vs depreciation (assume 30% tax rate)
        return amount * 0.30

      case 'GENERAL_DEDUCTION':
        // Assume 30% tax rate
        return amount * 0.30

      case 'BAD_DEBT':
        // Tax deduction at 30% rate
        return amount * 0.30

      default:
        return null
    }
  }

  private static generateFlags(category: string, amount: number): string[] {
    const flags: string[] = []

    if (category === 'R&D_TAX_INCENTIVE') {
      flags.push('HIGH_VALUE_CLAIM')
      flags.push('REQUIRES_REGISTRATION')
    }

    if (category === 'DIVISION_7A') {
      flags.push('COMPLIANCE_RISK')
      flags.push('DEEMED_DIVIDEND_RISK')
    }

    if (amount > 100000) {
      flags.push('HIGH_VALUE')
      flags.push('PROFESSIONAL_REVIEW_RECOMMENDED')
    }

    if (amount > 50000 && category === 'GENERAL_DEDUCTION') {
      flags.push('DOCUMENTATION_REQUIRED')
    }

    return flags
  }
}
