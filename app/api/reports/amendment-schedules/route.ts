import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:reports:amendment-schedules')

export async function GET(request: NextRequest) {
  // Authenticate and validate tenant access
  const auth = await requireAuth(request)
  if (isErrorResponse(auth)) return auth

  const { tenantId, supabase } = auth

  try {
    log.info('Generating amendment schedules', { tenantId })

    const { data: xeroOrg } = await supabase
      .from('xero_connections')
      .select('organisation_name, tax_number')
      .eq('tenant_id', tenantId)
      .single()

    const orgName = xeroOrg?.organisation_name || 'Organization'
    const abn = xeroOrg?.tax_number || 'N/A'

    // Fetch recommendations for amendments
    const { data: recommendations } = await supabase
      .from('tax_recommendations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('recommendation_type', 'amendment')
      .order('priority_score', { ascending: false })
      .limit(50)

    // Group by financial year
    type Recommendation = { financial_year?: string; priority?: string; recommendation_text?: string; claimable_amount?: number; deadline?: string }
    const byYear: Record<string, Recommendation[]> = {}
    recommendations?.forEach((rec: Recommendation) => {
      const year = rec.financial_year || 'Unknown'
      if (!byYear[year]) {
        byYear[year] = []
      }
      byYear[year].push(rec)
    })

    // Escape HTML to prevent XSS from Xero-sourced data
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    // Generate print-optimised HTML (use browser Print > Save as PDF)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Amendment Schedules - ${esc(orgName)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
    h1 { color: #4f46e5; font-size: 24px; margin-bottom: 10px; }
    h2 { color: #6366f1; font-size: 18px; margin-top: 30px; margin-bottom: 15px; }
    .header { margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .year-section { margin: 30px 0; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .total-row { font-weight: bold; background: #fef3c7; }
    .priority-critical { color: #ef4444; font-weight: bold; }
    .priority-high { color: #f59e0b; font-weight: bold; }
    .summary-box { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; }
    .print-hint { background: #eff6ff; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #3b82f6; }
    @media print { .print-hint { display: none; } }
  </style>
</head>
<body>
  <div class="print-hint">To save as PDF: Press <strong>Ctrl+P</strong> (or Cmd+P) and select "Save as PDF"</div>
  <div class="header">
    <h1>Tax Amendment Schedules</h1>
    <p style="font-size: 14px; color: #64748b;">
      ${esc(orgName)} | ABN: ${esc(abn)}<br>
      Generated: ${new Date().toLocaleDateString()}
    </p>
  </div>

  <div class="summary-box">
    <h3 style="margin-top: 0;">Summary of Amendments</h3>
    <p>Total amendments identified: ${recommendations?.length || 0}</p>
    <p>Financial years affected: ${Object.keys(byYear).length}</p>
    <p>Total estimated benefit: $${recommendations?.reduce((sum: number, r: Recommendation) => sum + (r.claimable_amount || 0), 0).toLocaleString()}</p>
  </div>

  ${Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, recs]) => `
    <div class="year-section">
      <h2>Financial Year ${esc(year)}</h2>
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Amendment Description</th>
            <th style="text-align: right;">Tax Benefit</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          ${recs.map(rec => `
            <tr>
              <td class="priority-${(rec.priority?.toLowerCase() || 'medium').replace(/[^a-z]/g, '')}">${esc(rec.priority || 'Medium')}</td>
              <td>${esc(rec.recommendation_text || 'N/A')}</td>
              <td style="text-align: right;">$${(rec.claimable_amount || 0).toLocaleString()}</td>
              <td>${rec.deadline ? new Date(rec.deadline).toLocaleDateString() : 'No deadline'}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">Total for ${esc(year)}</td>
            <td style="text-align: right;">$${recs.reduce((sum, r) => sum + (r.claimable_amount || 0), 0).toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  `).join('')}

  <div class="footer">
    <p><strong>DISCLAIMER:</strong> These amendment schedules are generated by automated software and do not
    constitute tax, financial, or legal advice. All recommendations should be reviewed by a registered tax
    agent or qualified tax professional before any action is taken. This software is not registered with
    the Tax Practitioners Board and does not provide tax agent services within the meaning of TASA 2009.</p>
    <p>Generated by ATO Optimizer</p>
  </div>
</body>
</html>
    `

    log.info('Amendment schedules generated as HTML', { tenantId, amendments: recommendations?.length || 0 })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="amendment-schedules-${tenantId}.html"`,
      }
    })
  } catch (error: unknown) {
    console.error('Amendment schedules generation failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate amendment schedules', details: errorMessage },
      { status: 500 }
    )
  }
}
