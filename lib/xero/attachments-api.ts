/**
 * Xero Attachments API Integration
 *
 * Attaches finding summaries to individual transactions in Xero
 * so accountants can see recommendations alongside the source data.
 *
 * Requires OAuth scope: 'accounting.attachments'
 */

import { TokenSet } from 'xero-node'
import { createServiceClient } from '@/lib/supabase/server'
import { isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { withRetry } from '@/lib/xero/retry'

// Rate limiting: Xero allows 60 requests/minute
const RATE_LIMIT_DELAY_MS = 1500 // 1.5 seconds between calls

export interface AttachFindingsOptions {
  tenantId: string
  recommendations: RecommendationForAttachment[]
  onProgress?: (completed: number, total: number, currentTransaction: string) => void
}

export interface RecommendationForAttachment {
  id: string
  action: string
  description: string
  taxArea: string
  financialYear: string
  estimatedBenefit: number
  confidence: number
  adjustedBenefit: number
  legislativeReference: string
  deadline: string
  documentationRequired: string[]
  atoForms: string[]
  transactionIds: string[]
}

export interface AttachmentResult {
  success: boolean
  totalTransactions: number
  attached: number
  failed: number
  skipped: number
  errors: Array<{ transactionId: string; error: string }>
}

/**
 * Attach finding summaries to transactions in Xero.
 * Creates a text attachment on each transaction with the recommendation details.
 */
export async function attachFindingsToXero(
  options: AttachFindingsOptions
): Promise<AttachmentResult> {
  const { tenantId, recommendations, onProgress } = options

  const result: AttachmentResult = {
    success: true,
    totalTransactions: 0,
    attached: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // Get authenticated tokens
  const { accessToken } = await getAuthTokens(tenantId)

  // Fetch transaction types from cache to determine correct endpoint
  const supabase = await createServiceClient()

  for (const rec of recommendations) {
    if (!rec.transactionIds || rec.transactionIds.length === 0) continue

    // Generate the finding summary once per recommendation
    const summaryText = generateFindingSummary(rec)
    const summaryBuffer = Buffer.from(summaryText, 'utf-8')

    for (const txnId of rec.transactionIds) {
      result.totalTransactions++

      try {
        // Look up transaction type from cache
        const { data: txn } = await supabase
          .from('historical_transactions_cache')
          .select('transaction_type')
          .eq('tenant_id', tenantId)
          .eq('transaction_id', txnId)
          .single()

        if (!txn) {
          result.skipped++
          continue
        }

        const endpoint = getAttachmentEndpoint(txn.transaction_type, txnId)
        if (!endpoint) {
          result.skipped++
          continue
        }

        // Upload attachment with retry
        await withRetry(
          async () => {
            const response = await fetch(endpoint, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Xero-Tenant-Id': tenantId,
                'Content-Type': 'text/plain',
                'Content-Length': String(summaryBuffer.length),
              },
              body: summaryBuffer,
            })

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Attachment failed: ${response.status} ${errorText}`)
            }

            return response.json()
          },
          {
            maxAttempts: 2,
            timeoutMs: 30000,
            initialBackoffMs: 2000,
          }
        )

        result.attached++
        onProgress?.(result.attached, result.totalTransactions, txnId)

        // Rate limit delay
        await delay(RATE_LIMIT_DELAY_MS)
      } catch (error) {
        result.failed++
        result.errors.push({
          transactionId: txnId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  result.success = result.failed === 0
  return result
}

/**
 * Generate a text summary of a recommendation to attach to a transaction.
 */
export function generateFindingSummary(rec: RecommendationForAttachment): string {
  const separator = '='.repeat(50)
  const lines: string[] = [
    separator,
    'ATO TAX OPTIMIZER - FINDING SUMMARY',
    separator,
    '',
    `RECOMMENDATION: ${rec.action}`,
    `Description: ${rec.description}`,
    '',
    `Tax Area: ${formatTaxArea(rec.taxArea)}`,
    `Financial Year: ${rec.financialYear}`,
    `Legislative Reference: ${rec.legislativeReference}`,
    '',
    `Estimated Benefit: $${rec.estimatedBenefit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
    `Confidence: ${rec.confidence}%`,
    `Adjusted Benefit: $${rec.adjustedBenefit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
    '',
    `Deadline: ${rec.deadline}`,
    '',
  ]

  if (rec.documentationRequired.length > 0) {
    lines.push('DOCUMENTATION REQUIRED:')
    for (const doc of rec.documentationRequired) {
      lines.push(`  - ${doc}`)
    }
    lines.push('')
  }

  if (rec.atoForms.length > 0) {
    lines.push('ATO FORMS:')
    for (const form of rec.atoForms) {
      lines.push(`  - ${form}`)
    }
    lines.push('')
  }

  lines.push(separator)
  lines.push('Generated by ATO Tax Optimizer')
  lines.push(`Date: ${new Date().toLocaleDateString('en-AU')}`)
  lines.push(separator)

  return lines.join('\n')
}

/**
 * Get the Xero API attachment endpoint for a given transaction type.
 */
function getAttachmentEndpoint(transactionType: string, transactionId: string): string | null {
  const baseUrl = 'https://api.xero.com/api.xro/2.0'

  switch (transactionType) {
    case 'BANK':
      return `${baseUrl}/BankTransactions/${transactionId}/Attachments/ATO_Finding.txt`
    case 'ACCPAY':
    case 'ACCREC':
      return `${baseUrl}/Invoices/${transactionId}/Attachments/ATO_Finding.txt`
    default:
      return null
  }
}

function formatTaxArea(area: string): string {
  const map: Record<string, string> = {
    rnd: 'R&D Tax Incentive (Division 355 ITAA 1997)',
    deductions: 'General Deductions (Section 8-1 ITAA 1997)',
    losses: 'Tax Losses (Division 36 ITAA 1997)',
    div7a: 'Division 7A (ITAA 1936)',
  }
  return map[area] || area
}

/**
 * Get authenticated access token for a tenant.
 */
async function getAuthTokens(
  tenantId: string
): Promise<{ accessToken: string }> {
  const supabase = await createServiceClient()

  const { data: connection, error } = await supabase
    .from('xero_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !connection) {
    throw new Error(`No Xero connection found for tenant ${tenantId}`)
  }

  let tokenSet = {
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expires_at: connection.expires_at,
    id_token: connection.id_token,
    scope: connection.scope,
    token_type: 'Bearer',
  } as TokenSet

  if (isTokenExpired(tokenSet)) {
    tokenSet = await refreshXeroTokens(tokenSet)

    await supabase
      .from('xero_connections')
      .update({
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_at,
        id_token: tokenSet.id_token,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
  }

  return { accessToken: tokenSet.access_token! }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
