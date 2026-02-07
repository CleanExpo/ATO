/**
 * POST /api/reports/consolidated/download
 *
 * Generate and download a consolidated report in Excel format.
 *
 * This endpoint generates a formatted Excel workbook containing:
 * - Portfolio Summary sheet with key metrics
 * - Client Reports sheet with detailed breakdown
 * - Top Opportunities sheet highlighting priority actions
 * - Charts and visualizations
 *
 * Body:
 * - batchSize?: number (optional, default: 5, max: 10)
 * - organizationIds?: string[] (optional - filter to specific organizations)
 * - format: 'excel' | 'csv' (default: 'excel')
 *
 * Response: Excel file download
 *
 * Security:
 * - Requires authentication
 * - Only includes organizations the user has access to
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse, createValidationError, createAuthError } from '@/lib/api/errors';
import { generateConsolidatedReport, formatCurrency, formatPercentage } from '@/lib/reports/consolidated-report-generator';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:reports:consolidated:download');

const downloadConsolidatedReportSchema = z.object({
  batchSize: z.number().int().min(1).max(10).default(5),
  organizationIds: z.array(z.string().uuid()).optional(),
  format: z.enum(['excel', 'csv']).default('excel'),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('[CONSOLIDATED_DOWNLOAD] Unauthorized access attempt');
      return createAuthError('Authentication required to download consolidated reports');
    }

    // Validate request body
    const body = await request.json();
    const validation = downloadConsolidatedReportSchema.safeParse(body);

    if (!validation.success) {
      return createValidationError(
        validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      );
    }

    const { batchSize, organizationIds, format } = validation.data;

    log.info('Generating download', { format, userId: user.id });

    // Generate the consolidated report
    const report = await generateConsolidatedReport(user.id, supabase, batchSize);

    // Filter to requested organizations if specified
    let clientReports = report.clientReports;
    if (organizationIds && organizationIds.length > 0) {
      const organizationIdSet = new Set(organizationIds);
      clientReports = clientReports.filter((cr) => organizationIdSet.has(cr.organizationId));
    }

    if (format === 'excel') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Australian Tax Optimizer';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Portfolio Summary Sheet
      const summarySheet = workbook.addWorksheet('Portfolio Summary', {
        properties: { tabColor: { argb: 'FF4CAF50' } },
      });

      // Header styling
      const headerStyle = {
        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2196F3' } },
        alignment: { vertical: 'middle' as const, horizontal: 'left' as const },
      };

      const currencyStyle = {
        numFmt: '$#,##0.00',
        alignment: { horizontal: 'right' as const },
      };

      // Portfolio Summary
      summarySheet.addRow(['PORTFOLIO SUMMARY']);
      summarySheet.getRow(1).font = { bold: true, size: 16 };
      summarySheet.addRow([]);

      summarySheet.addRow(['Accountant', report.metadata.accountantName]);
      summarySheet.addRow(['Email', report.metadata.accountantEmail]);
      summarySheet.addRow(['Generated', report.metadata.generatedAt.toLocaleString('en-AU')]);
      summarySheet.addRow(['Report ID', report.metadata.reportId]);
      summarySheet.addRow([]);

      summarySheet.addRow(['KEY METRICS']);
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };
      summarySheet.addRow(['Total Clients', report.metadata.totalClients]);
      summarySheet.addRow(['Successful Reports', report.metadata.successfulReports]);
      summarySheet.addRow(['Failed Reports', report.metadata.failedReports]);
      summarySheet.addRow([]);

      summarySheet.addRow(['OPPORTUNITY ANALYSIS']);
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };

      const totalOpportunityRow = summarySheet.addRow([
        'Total Opportunity',
        report.portfolioSummary.totalAdjustedOpportunity,
      ]);
      totalOpportunityRow.getCell(2).style = currencyStyle;
      totalOpportunityRow.font = { bold: true };

      const avgOpportunityRow = summarySheet.addRow([
        'Average per Client',
        report.portfolioSummary.averageOpportunityPerClient,
      ]);
      avgOpportunityRow.getCell(2).style = currencyStyle;

      summarySheet.addRow([]);
      summarySheet.addRow(['BREAKDOWN BY CATEGORY']);
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };

      const rndRow = summarySheet.addRow([
        'R&D Tax Incentive',
        report.portfolioSummary.totalRndOpportunity,
      ]);
      rndRow.getCell(2).style = currencyStyle;

      const deductionsRow = summarySheet.addRow([
        'Deductions',
        report.portfolioSummary.totalDeductionOpportunity,
      ]);
      deductionsRow.getCell(2).style = currencyStyle;

      const lossesRow = summarySheet.addRow([
        'Loss Recovery',
        report.portfolioSummary.totalLossRecovery,
      ]);
      lossesRow.getCell(2).style = currencyStyle;

      const div7aRow = summarySheet.addRow([
        'Div 7A Risk',
        report.portfolioSummary.totalDiv7aRisk,
      ]);
      div7aRow.getCell(2).style = currencyStyle;

      summarySheet.addRow([]);
      summarySheet.addRow(['OPPORTUNITY DISTRIBUTION']);
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };
      summarySheet.addRow([
        'Above $100,000',
        report.portfolioSummary.opportunityDistribution.above100k,
      ]);
      summarySheet.addRow([
        '$50,000 - $100,000',
        report.portfolioSummary.opportunityDistribution.between50kAnd100k,
      ]);
      summarySheet.addRow([
        '$20,000 - $50,000',
        report.portfolioSummary.opportunityDistribution.between20kAnd50k,
      ]);
      summarySheet.addRow([
        'Below $20,000',
        report.portfolioSummary.opportunityDistribution.below20k,
      ]);

      summarySheet.addRow([]);
      summarySheet.addRow(['INSIGHTS']);
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };
      summarySheet.addRow([
        'Time Saved (Hours)',
        report.insights.totalTimeSaved,
      ]);
      summarySheet.addRow([
        'Average Confidence',
        `${report.insights.averageConfidence.toFixed(1)}%`,
      ]);
      summarySheet.addRow([
        'Critical Action Items',
        report.insights.criticalActionItems,
      ]);

      // Set column widths
      summarySheet.getColumn(1).width = 30;
      summarySheet.getColumn(2).width = 20;

      // Client Reports Sheet
      const clientsSheet = workbook.addWorksheet('Client Reports', {
        properties: { tabColor: { argb: 'FFFF9800' } },
      });

      // Header row
      const headerRow = clientsSheet.addRow([
        'Organization Name',
        'ABN',
        'Status',
        'Total Opportunity',
        'Adjusted Opportunity',
        'R&D',
        'Deductions',
        'Losses',
        'Div 7A',
        'Confidence %',
        'Error Message',
      ]);

      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Data rows
      clientReports.forEach((client) => {
        const row = clientsSheet.addRow([
          client.organizationName,
          client.abn || 'N/A',
          client.status,
          client.totalOpportunity,
          client.adjustedOpportunity,
          client.breakdown.rnd,
          client.breakdown.deductions,
          client.breakdown.losses,
          client.breakdown.div7a,
          client.confidence,
          client.errorMessage || '',
        ]);

        // Apply currency formatting to monetary columns
        [4, 5, 6, 7, 8, 9].forEach((colNum) => {
          row.getCell(colNum).style = currencyStyle;
        });

        // Color code by status
        if (client.status === 'failed') {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEBEE' },
            };
          });
        } else if (client.adjustedOpportunity > 100000) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE8F5E9' },
            };
          });
        }
      });

      // Set column widths
      clientsSheet.getColumn(1).width = 30; // Organization Name
      clientsSheet.getColumn(2).width = 15; // ABN
      clientsSheet.getColumn(3).width = 12; // Status
      [4, 5, 6, 7, 8, 9].forEach((col) => {
        clientsSheet.getColumn(col).width = 18; // Monetary columns
      });
      clientsSheet.getColumn(10).width = 12; // Confidence
      clientsSheet.getColumn(11).width = 40; // Error Message

      // Auto-filter
      clientsSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 11 },
      };

      // Top Opportunities Sheet
      const topSheet = workbook.addWorksheet('Top Opportunities', {
        properties: { tabColor: { argb: 'FFF44336' } },
      });

      const topHeaderRow = topSheet.addRow([
        'Rank',
        'Organization',
        'Opportunity',
        '% of Total',
      ]);

      topHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      report.portfolioSummary.topClients.forEach((client, index) => {
        const row = topSheet.addRow([
          index + 1,
          client.name,
          client.opportunity,
          client.percentage,
        ]);

        row.getCell(3).style = currencyStyle;
        row.getCell(4).numFmt = '0.0%';
        row.getCell(4).value = client.percentage / 100;
      });

      topSheet.getColumn(1).width = 8;
      topSheet.getColumn(2).width = 30;
      topSheet.getColumn(3).width = 18;
      topSheet.getColumn(4).width = 15;

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Return as download
      const filename = `Consolidated-Report-${report.metadata.accountantName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(buffer.byteLength),
        },
      });
    } else {
      // CSV format - simpler flat structure
      const csvRows: string[] = [];

      // Header
      csvRows.push(
        'Organization Name,ABN,Status,Total Opportunity,Adjusted Opportunity,R&D,Deductions,Losses,Div 7A,Confidence %,Error Message'
      );

      // Data rows
      clientReports.forEach((client) => {
        csvRows.push(
          [
            `"${client.organizationName}"`,
            client.abn || 'N/A',
            client.status,
            client.totalOpportunity.toFixed(2),
            client.adjustedOpportunity.toFixed(2),
            client.breakdown.rnd.toFixed(2),
            client.breakdown.deductions.toFixed(2),
            client.breakdown.losses.toFixed(2),
            client.breakdown.div7a.toFixed(2),
            client.confidence.toFixed(1),
            `"${(client.errorMessage || '').replace(/"/g, '""')}"`,
          ].join(',')
        );
      });

      const csvContent = csvRows.join('\n');
      const filename = `Consolidated-Report-${report.metadata.accountantName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error('[CONSOLIDATED_DOWNLOAD] Failed to generate download:', error);
    return createErrorResponse(
      error as Error,
      {
        operation: 'download_consolidated_report',
      },
      500
    );
  }
}
