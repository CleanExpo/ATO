import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { createErrorResponse, createValidationError, createNotFoundError } from '@/lib/api/errors'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import type { TokenSet } from 'xero-node'
import { isSingleUserMode } from '@/lib/auth/single-user-check'
import { decryptStoredToken, encryptTokenForStorage } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

type XeroReportCell = {
    value?: string
    attributes?: Record<string, unknown>
}

type XeroReportRow = {
    rowType?: string
    title?: string
    rows?: XeroReportRow[]
    cells?: XeroReportCell[]
}

type XeroReport = {
    reportTitle?: string
    reportDate?: string
    rows?: XeroReportRow[]
}

type ParsedReportSectionRow = {
    account?: string
    values: XeroReportCell[]
}

type ParsedReportSection = {
    title?: string
    rows: ParsedReportSectionRow[]
    summary?: {
        label?: string
        values: XeroReportCell[]
    }
}

type ParsedReport = {
    title?: string
    date?: string
    sections: ParsedReportSection[]
} | null

// Helper to get valid token set for a tenant (single-user mode)
async function getValidTokenSet(tenantId: string, baseUrl?: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

    if (error || !connection) {
        return null
    }

    // Decrypt tokens from database (SEC-001)
    const tokenSet = {
        access_token: decryptStoredToken(connection.access_token),
        refresh_token: decryptStoredToken(connection.refresh_token),
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    } as TokenSet

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet, baseUrl)

            // Encrypt new tokens before storage (SEC-001)
            await supabase
                .from('xero_connections')
                .update({
                    access_token: encryptTokenForStorage(newTokens.access_token),
                    refresh_token: encryptTokenForStorage(newTokens.refresh_token),
                    expires_at: newTokens.expires_at,
                    id_token: newTokens.id_token,
                    scope: newTokens.scope,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenantId)

            return newTokens
        } catch (error) {
            console.error('Failed to refresh Xero tokens:', error)
            return null
        }
    }

    return tokenSet
}

// GET /api/xero/reports - Get financial reports
export async function GET(request: NextRequest) {
    try {
        let tenantId: string

        if (isSingleUserMode()) {
            // Single-user mode: get tenantId from query param
            const queryTenantId = request.nextUrl.searchParams.get('tenantId')
            if (!queryTenantId) {
                return createValidationError('tenantId is required')
            }
            tenantId = queryTenantId
        } else {
            // Multi-user mode: authenticate and validate tenant access
            const auth = await requireAuth(request)
            if (isErrorResponse(auth)) return auth
            tenantId = auth.tenantId
        }

        const baseUrl = request.nextUrl.origin
        const reportType = request.nextUrl.searchParams.get('type') || 'TrialBalance'
        const fromDate = request.nextUrl.searchParams.get('fromDate')
        const toDate = request.nextUrl.searchParams.get('toDate')

        const tokenSet = await getValidTokenSet(tenantId, baseUrl)
        if (!tokenSet) {
            return createNotFoundError('Xero connection')
        }

        const client = createXeroClient({ baseUrl })
        client.setTokenSet(tokenSet)

        let reportData: XeroReport | undefined

        switch (reportType) {
            case 'TrialBalance':
                const trialBalance = await client.accountingApi.getReportTrialBalance(
                    tenantId,
                    toDate || undefined
                )
                reportData = trialBalance.body.reports?.[0] as XeroReport | undefined
                break

            case 'ProfitAndLoss':
                const profitLoss = await client.accountingApi.getReportProfitAndLoss(
                    tenantId,
                    fromDate || undefined,
                    toDate || undefined
                )
                reportData = profitLoss.body.reports?.[0] as XeroReport | undefined
                break

            case 'BalanceSheet':
                const balanceSheet = await client.accountingApi.getReportBalanceSheet(
                    tenantId,
                    toDate || undefined
                )
                reportData = balanceSheet.body.reports?.[0] as XeroReport | undefined
                break

            default:
                return createValidationError('Invalid report type. Must be TrialBalance, ProfitAndLoss, or BalanceSheet')
        }

        // Parse report into structured data
        const parsedReport = parseXeroReport(reportData || null)

        return NextResponse.json({
            report: parsedReport,
            reportType,
            generatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('Failed to fetch report:', error)
        return createErrorResponse(error, { operation: 'fetchXeroReport' }, 500)
    }
}

// Helper to parse Xero report format
function parseXeroReport(report: XeroReport | null): ParsedReport {
    if (!report || !report.rows) {
        return null
    }

    const sections: ParsedReportSection[] = []
    let currentSection: ParsedReportSection | null = null

    for (const row of report.rows) {
        if (row.rowType === 'Header') {
            // Column headers
            continue
        }

        if (row.rowType === 'Section') {
            if (currentSection) {
                sections.push(currentSection)
            }
            currentSection = {
                title: row.title,
                rows: []
            }

            // Process section rows
            if (row.rows) {
                for (const subRow of row.rows) {
                    if (subRow.rowType === 'Row') {
                        currentSection.rows.push({
                            account: subRow.cells?.[0]?.value,
                            values: subRow.cells?.slice(1) || []
                        })
                    } else if (subRow.rowType === 'SummaryRow') {
                        currentSection.summary = {
                            label: subRow.cells?.[0]?.value,
                            values: subRow.cells?.slice(1) || []
                        }
                    }
                }
            }
        }
    }

    if (currentSection) {
        sections.push(currentSection)
    }

    return {
        title: report.reportTitle,
        date: report.reportDate,
        sections
    }
}
