import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import type { TokenSet } from 'xero-node'

// Helper to get valid token set for a tenant
async function getValidTokenSet(tenantId: string): Promise<TokenSet | null> {
    const supabase = await createServiceClient()

    const { data: connection, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

    if (error || !connection) {
        return null
    }

    const tokenSet: TokenSet = {
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
        expires_at: connection.expires_at,
        id_token: connection.id_token,
        scope: connection.scope,
        token_type: 'Bearer'
    }

    // Refresh if expired
    if (isTokenExpired(tokenSet)) {
        try {
            const newTokens = await refreshXeroTokens(tokenSet)

            // Update stored tokens
            await supabase
                .from('xero_connections')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at,
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
        const tenantId = request.nextUrl.searchParams.get('tenantId')
        const reportType = request.nextUrl.searchParams.get('type') || 'TrialBalance'
        const fromDate = request.nextUrl.searchParams.get('fromDate')
        const toDate = request.nextUrl.searchParams.get('toDate')

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 })
        }

        const tokenSet = await getValidTokenSet(tenantId)
        if (!tokenSet) {
            return NextResponse.json({ error: 'No valid connection found' }, { status: 401 })
        }

        const client = createXeroClient()
        client.setTokenSet(tokenSet)

        let reportData: any = null

        switch (reportType) {
            case 'TrialBalance':
                const trialBalance = await client.accountingApi.getReportTrialBalance(
                    tenantId,
                    toDate || undefined
                )
                reportData = trialBalance.body.reports?.[0]
                break

            case 'ProfitAndLoss':
                const profitLoss = await client.accountingApi.getReportProfitAndLoss(
                    tenantId,
                    fromDate || undefined,
                    toDate || undefined
                )
                reportData = profitLoss.body.reports?.[0]
                break

            case 'BalanceSheet':
                const balanceSheet = await client.accountingApi.getReportBalanceSheet(
                    tenantId,
                    toDate || undefined
                )
                reportData = balanceSheet.body.reports?.[0]
                break

            default:
                return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
        }

        // Parse report into structured data
        const parsedReport = parseXeroReport(reportData)

        return NextResponse.json({
            report: parsedReport,
            reportType,
            generatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('Failed to fetch report:', error)
        return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
    }
}

// Helper to parse Xero report format
function parseXeroReport(report: any) {
    if (!report || !report.rows) {
        return null
    }

    const sections: any[] = []
    let currentSection: any = null

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
                            values: subRow.cells?.slice(1).map((c: any) => ({
                                value: c.value,
                                attributes: c.attributes
                            }))
                        })
                    } else if (subRow.rowType === 'SummaryRow') {
                        currentSection.summary = {
                            label: subRow.cells?.[0]?.value,
                            values: subRow.cells?.slice(1).map((c: any) => ({
                                value: c.value,
                                attributes: c.attributes
                            }))
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
