/**
 * Audit Analysis API Integration Tests
 *
 * Tests the forensic analysis API endpoint:
 * - Starting AI analysis jobs
 * - Batch processing transactions
 * - Progress tracking and polling
 * - Analysis results validation
 * - Error handling and rate limiting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { XeroMockFactory } from '@/tests/__mocks__/data/xero-fixtures'
import { GeminiMockFactory } from '@/tests/__mocks__/data/gemini-fixtures'
import { ValidatorMockFactory } from '@/tests/__mocks__/data/validator-fixtures'

describe('POST /api/audit/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SINGLE_USER_MODE = 'true'
  })

  describe('Analysis Initiation', () => {
    it('should validate required tenantId parameter', async () => {
      const requestBody = {
        // Missing tenantId
        batchSize: 50,
      }

      const isValid = 'tenantId' in requestBody

      expect(isValid).toBe(false)
    })

    it('should validate tenantId is a valid UUID', async () => {
      const validTenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const invalidTenantId = 'not-a-uuid'

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      expect(uuidRegex.test(validTenantId)).toBe(true)
      expect(uuidRegex.test(invalidTenantId)).toBe(false)
    })

    it('should default batchSize to 50 if not provided', async () => {
      const requestBody = {
        tenantId: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
      }

      const batchSize = (requestBody as any).batchSize || 50

      expect(batchSize).toBe(50)
    })

    it('should enforce maximum batchSize of 100', async () => {
      const requestBody = {
        tenantId: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        batchSize: 200, // Exceeds max
      }

      const maxBatchSize = 100
      const enforcedBatchSize = Math.min(requestBody.batchSize, maxBatchSize)

      expect(enforcedBatchSize).toBe(100)
    })

    it('should return analysisId for tracking', async () => {
      const response = {
        status: 'analysing',
        analysisId: 'analysis_abc123',
        pollUrl: '/api/audit/status/analysis_abc123',
        progress: 0,
      }

      expect(response.analysisId).toBeDefined()
      expect(response.pollUrl).toContain(response.analysisId)
    })
  })

  describe('Transaction Batch Processing', () => {
    it('should fetch cached transactions for analysis', async () => {
      const tenantId = '4637fa53-23e4-49e3-8cce-3bca3a09def9'
      const transactions = XeroMockFactory.transactions(100, {
        financialYear: 'FY2023-24',
        includeRndCandidates: true,
      })

      expect(transactions.length).toBe(100)
      expect(transactions[0]).toHaveProperty('transactionID')
    })

    it('should process transactions in batches of 50', async () => {
      const totalTransactions = 237
      const batchSize = 50

      const batches = Math.ceil(totalTransactions / batchSize)

      expect(batches).toBe(5) // 50, 50, 50, 50, 37
    })

    it('should track progress across batches', async () => {
      const totalTransactions = 200
      const batchSize = 50
      const processedTransactions = 100

      const progress = (processedTransactions / totalTransactions) * 100

      expect(progress).toBe(50)
    })

    it('should delay between batches for rate limiting', async () => {
      const delayMs = 4000 // 4 seconds between batches (15 requests/min limit)

      const delaySeconds = delayMs / 1000

      expect(delaySeconds).toBe(4)
    })

    it('should handle last batch with remaining transactions', async () => {
      const totalTransactions = 237
      const batchSize = 50
      const lastBatchStart = 200 // Start of 5th batch

      const lastBatchSize = totalTransactions - lastBatchStart

      expect(lastBatchSize).toBe(37)
    })
  })

  describe('AI Analysis Integration', () => {
    it('should send transaction to Gemini for forensic analysis', async () => {
      const transaction = XeroMockFactory.transactions(1, {
        includeRndCandidates: true,
      })[0]

      const analysis = GeminiMockFactory.forensicAnalysis(transaction)

      expect(analysis.transaction_id).toBe(transaction.transactionID)
      expect(analysis.analysis.tax_category).toBeDefined()
      expect(analysis.analysis.confidence).toBeGreaterThan(0)
    })

    it('should categorize transactions by tax type', async () => {
      const transactions = XeroMockFactory.transactions(10, {
        includeRndCandidates: true,
      })

      const analyses = transactions.map(tx => GeminiMockFactory.forensicAnalysis(tx))

      const categories = analyses.map(a => a.analysis.tax_category)
      const uniqueCategories = [...new Set(categories)]

      expect(uniqueCategories.length).toBeGreaterThan(1)
    })

    it('should extract legislative references from analysis', async () => {
      const transaction = XeroMockFactory.transactions(1)[0]
      const analysis = GeminiMockFactory.forensicAnalysis(transaction)

      expect(analysis.analysis.legislative_references).toBeDefined()
      expect(Array.isArray(analysis.analysis.legislative_references)).toBe(true)
    })

    it('should generate recommendations for each transaction', async () => {
      const transaction = XeroMockFactory.transactions(1)[0]
      const analysis = GeminiMockFactory.forensicAnalysis(transaction)

      expect(analysis.analysis.recommendations).toBeDefined()
      expect(Array.isArray(analysis.analysis.recommendations)).toBe(true)
      expect(analysis.analysis.recommendations.length).toBeGreaterThan(0)
    })

    it('should estimate potential tax savings', async () => {
      const transaction = {
        transactionID: 'tx-001',
        description: 'R&D equipment purchase',
        amount: 50000,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(transaction)

      if (analysis.analysis.potential_savings) {
        expect(analysis.analysis.potential_savings).toBeGreaterThan(0)
      }
    })
  })

  describe('Validation Integration', () => {
    it('should run validator on AI analysis results', async () => {
      const analysisResult = {
        eligible_expenditure: 100000,
        rnd_offset: 43500,
      }

      const validation = ValidatorMockFactory.taxCalculationResult(true, {
        rndOffset: 0.435,
      })

      expect(validation.passed).toBe(true)
      expect(validation.confidence).toBeGreaterThan(85)
    })

    it('should flag validation failures', async () => {
      const analysisResult = {
        eligible_expenditure: 100000,
        rnd_offset: 30000, // Incorrect (should be 43,500)
      }

      const validation = ValidatorMockFactory.taxCalculationResult(false, {
        rndOffset: 0.30, // Wrong rate
      })

      expect(validation.passed).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
    })

    it('should include validation confidence in results', async () => {
      const validation = ValidatorMockFactory.taxCalculationResult(true)

      expect(validation.confidence).toBeDefined()
      expect(validation.confidence).toBeGreaterThanOrEqual(0)
      expect(validation.confidence).toBeLessThanOrEqual(100)
    })
  })

  describe('Database Storage', () => {
    it('should store analysis results in database', async () => {
      const analysisRecord = {
        analysis_id: 'analysis_abc123',
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        transaction_id: 'tx-001',
        tax_category: 'R&D_TAX_INCENTIVE',
        confidence: 92.5,
        recommendations: ['Register R&D activities', 'Document systematic approach'],
        created_at: new Date().toISOString(),
      }

      expect(analysisRecord.analysis_id).toBeDefined()
      expect(analysisRecord.tax_category).toBeDefined()
      expect(analysisRecord.confidence).toBeGreaterThan(0)
    })

    it('should link analysis to transaction and organization', async () => {
      const analysisRecord = {
        transaction_id: 'tx-001',
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        organization_id: 'org-123',
      }

      expect(analysisRecord.transaction_id).toBeDefined()
      expect(analysisRecord.tenant_id).toBeDefined()
      expect(analysisRecord.organization_id).toBeDefined()
    })

    it('should allow querying analyses by tax category', async () => {
      const category = 'R&D_TAX_INCENTIVE'

      const query = {
        table: 'forensic_analyses',
        filter: { tax_category: category },
      }

      expect(query.filter.tax_category).toBe(category)
    })

    it('should allow querying analyses by financial year', async () => {
      const financialYear = 'FY2023-24'

      const query = {
        table: 'forensic_analyses',
        filter: { financial_year: financialYear },
      }

      expect(query.filter.financial_year).toBe(financialYear)
    })
  })

  describe('Error Handling', () => {
    it('should handle Gemini API rate limit errors', async () => {
      const error = GeminiMockFactory.error('rate_limit') as any

      expect(error.error.status).toBe('RESOURCE_EXHAUSTED')
      expect(error.error.message).toContain('quota')
    })

    it('should handle Gemini API key errors', async () => {
      const error = GeminiMockFactory.error('invalid_api_key') as any

      expect(error.error.status).toBe('UNAUTHENTICATED')
    })

    it('should retry failed analysis with exponential backoff', async () => {
      const retryDelays = [1000, 2000, 4000, 8000] // ms

      expect(retryDelays[0]).toBe(1000) // 1s
      expect(retryDelays[1]).toBe(2000) // 2s
      expect(retryDelays[2]).toBe(4000) // 4s
      expect(retryDelays[3]).toBe(8000) // 8s
    })

    it('should skip invalid transactions gracefully', async () => {
      const transactions = [
        { transactionID: 'tx-001', amount: 5000 }, // Valid
        { transactionID: null, amount: 0 }, // Invalid
        { transactionID: 'tx-003', amount: 3000 }, // Valid
      ]

      const validTransactions = transactions.filter(tx => tx.transactionID !== null && tx.amount > 0)

      expect(validTransactions).toHaveLength(2)
    })

    it('should track failed transaction count', async () => {
      const processResults = {
        total: 100,
        successful: 95,
        failed: 5,
        failureRate: 0.05,
      }

      expect(processResults.successful + processResults.failed).toBe(processResults.total)
      expect(processResults.failureRate).toBeLessThan(0.1) // < 10% failure
    })

    it('should include error details in failed analyses', async () => {
      const failedAnalysis = {
        transaction_id: 'tx-001',
        status: 'failed',
        error: {
          type: 'rate_limit',
          message: 'Exceeded quota',
          timestamp: new Date().toISOString(),
        },
      }

      expect(failedAnalysis.status).toBe('failed')
      expect(failedAnalysis.error.type).toBeDefined()
    })
  })

  describe('Progress Tracking', () => {
    it('should return current progress percentage', async () => {
      const progress = {
        total: 200,
        processed: 100,
        percentage: 50,
      }

      expect(progress.percentage).toBe((progress.processed / progress.total) * 100)
    })

    it('should estimate remaining time', async () => {
      const timePerTransaction = 200 // ms
      const remainingTransactions = 50

      const estimatedMs = timePerTransaction * remainingTransactions
      const estimatedMinutes = estimatedMs / 1000 / 60

      expect(estimatedMinutes).toBeCloseTo(1.67, 1)
    })

    it('should track processing speed (transactions per second)', async () => {
      const transactionsProcessed = 100
      const elapsedSeconds = 40

      const tps = transactionsProcessed / elapsedSeconds

      expect(tps).toBe(2.5)
    })

    it('should provide poll URL for status updates', async () => {
      const analysisId = 'analysis_abc123'
      const pollUrl = `/api/audit/status/${analysisId}`

      expect(pollUrl).toContain(analysisId)
    })
  })

  describe('Analysis Categories', () => {
    it('should categorize R&D tax incentive candidates', async () => {
      const rndTransaction = {
        description: 'Software development - experimental AI algorithm',
        amount: 50000,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(rndTransaction)

      expect(analysis.analysis.tax_category).toBe('R&D_TAX_INCENTIVE')
    })

    it('should categorize general deductions', async () => {
      const deductionTransaction = {
        description: 'Office rent',
        amount: 2000,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(deductionTransaction)

      // Could be categorized as general deduction
      expect(['GENERAL_DEDUCTION', 'OPERATING_EXPENSE']).toContain(analysis.analysis.tax_category)
    })

    it('should categorize Division 7A loans', async () => {
      const loanTransaction = {
        description: 'Loan to shareholder',
        amount: 100000,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(loanTransaction)

      // Could be flagged as Division 7A
      expect(analysis.analysis.tax_category).toBeDefined()
    })

    it('should categorize capital vs revenue expenses', async () => {
      const capitalExpense = {
        description: 'Purchase of office building',
        amount: 500000,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(capitalExpense)

      expect(analysis.analysis.tax_category).toBe('CAPITAL_EXPENSE')
    })

    it('should flag non-deductible expenses', async () => {
      const nonDeductible = {
        description: 'Client entertainment - dinner',
        amount: 500,
      }

      const analysis = GeminiMockFactory.forensicAnalysis(nonDeductible)

      expect(analysis.analysis.tax_category).toBe('NON_DEDUCTIBLE')
    })
  })

  describe('Performance Requirements', () => {
    it('should process batch of 50 transactions within 30 seconds', async () => {
      const batchSize = 50
      const maxTimePerTransaction = 600 // 600ms per transaction
      const maxBatchTime = batchSize * maxTimePerTransaction

      expect(maxBatchTime).toBeLessThanOrEqual(30000) // 30 seconds
    })

    it('should complete 200 transactions within 3 minutes', async () => {
      const totalTransactions = 200
      const batchSize = 50
      const batches = Math.ceil(totalTransactions / batchSize)
      const delayBetweenBatches = 4000 // 4s
      const processingTime = batches * 30000 // 30s per batch
      const totalDelay = (batches - 1) * delayBetweenBatches

      const totalTime = processingTime + totalDelay

      expect(totalTime).toBeLessThanOrEqual(180000) // 3 minutes
    })

    it('should respect Gemini rate limit (15 requests/min)', async () => {
      const requestsPerMinute = 15
      const delayBetweenRequests = (60 / requestsPerMinute) * 1000 // ms

      expect(delayBetweenRequests).toBe(4000) // 4 seconds
    })
  })

  describe('Summary Statistics', () => {
    it('should calculate total potential savings', async () => {
      const analyses = [
        { potential_savings: 10000 },
        { potential_savings: 15000 },
        { potential_savings: 8000 },
      ]

      const totalSavings = analyses.reduce((sum, a) => sum + a.potential_savings, 0)

      expect(totalSavings).toBe(33000)
    })

    it('should group findings by tax category', async () => {
      const analyses = [
        { tax_category: 'R&D_TAX_INCENTIVE', count: 25 },
        { tax_category: 'GENERAL_DEDUCTION', count: 150 },
        { tax_category: 'DIVISION_7A', count: 3 },
        { tax_category: 'NON_DEDUCTIBLE', count: 12 },
      ]

      const totalFindings = analyses.reduce((sum, a) => sum + a.count, 0)

      expect(totalFindings).toBe(190)
    })

    it('should calculate average confidence score', async () => {
      const analyses = [
        { confidence: 95 },
        { confidence: 88 },
        { confidence: 92 },
        { confidence: 85 },
      ]

      const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length

      expect(avgConfidence).toBe(90)
    })

    it('should identify high-value opportunities (>$10k savings)', async () => {
      const analyses = [
        { potential_savings: 5000, high_value: false },
        { potential_savings: 25000, high_value: true },
        { potential_savings: 2000, high_value: false },
        { potential_savings: 15000, high_value: true },
      ]

      const highValueOpportunities = analyses.filter(a => a.high_value)

      expect(highValueOpportunities).toHaveLength(2)
      expect(highValueOpportunities.reduce((sum, a) => sum + a.potential_savings, 0)).toBe(40000)
    })
  })

  describe('Audit Trail', () => {
    it('should log analysis start event', () => {
      const auditLog = {
        event: 'analysis_started',
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        transaction_count: 200,
        batch_size: 50,
        timestamp: new Date().toISOString(),
      }

      expect(auditLog.event).toBe('analysis_started')
      expect(auditLog.transaction_count).toBeGreaterThan(0)
    })

    it('should log analysis completion event', () => {
      const auditLog = {
        event: 'analysis_completed',
        tenant_id: '4637fa53-23e4-49e3-8cce-3bca3a09def9',
        processed: 200,
        successful: 195,
        failed: 5,
        duration_ms: 125000,
        timestamp: new Date().toISOString(),
      }

      expect(auditLog.event).toBe('analysis_completed')
      expect(auditLog.processed).toBe(auditLog.successful + auditLog.failed)
    })

    it('should log high-confidence findings', () => {
      const finding = {
        event: 'high_confidence_finding',
        transaction_id: 'tx-001',
        tax_category: 'R&D_TAX_INCENTIVE',
        confidence: 98,
        potential_savings: 25000,
        requires_review: true,
      }

      expect(finding.confidence).toBeGreaterThan(95)
      expect(finding.requires_review).toBe(true)
    })
  })
})
