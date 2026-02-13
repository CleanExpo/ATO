/**
 * Unit tests for Consolidated Report Generator
 *
 * Tests cover:
 * - Report generation with multiple organizations
 * - Portfolio summary calculations
 * - Error handling for failed client reports
 * - Batch processing logic
 * - Top clients ranking
 * - Opportunity distribution categorization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConsolidatedReport, ClientReportSummary } from '@/lib/reports/consolidated-report-generator';
import type { SupabaseServiceClient } from '@/lib/supabase/server';

// Create a mock Supabase client to pass directly to generateConsolidatedReport
function createMockSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    full_name: 'Test Accountant',
                    email: 'accountant@test.com',
                  },
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      if (table === 'user_organization_access') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      organization_id: 'org-1',
                      organizations: {
                        id: 'org-1',
                        name: 'Test Corp 1',
                        abn: '12345678901',
                        xero_tenant_id: 'tenant-1',
                      },
                    },
                    {
                      organization_id: 'org-2',
                      organizations: {
                        id: 'org-2',
                        name: 'Test Corp 2',
                        abn: '12345678902',
                        xero_tenant_id: 'tenant-2',
                      },
                    },
                    {
                      organization_id: 'org-3',
                      organizations: {
                        id: 'org-3',
                        name: 'Test Corp 3',
                        abn: '12345678903',
                        xero_tenant_id: 'tenant-3',
                      },
                    },
                  ],
                  error: null,
                })
              ),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

// Mock Supabase server module (not used directly by generateConsolidatedReport,
// but may be imported transitively)
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => createMockSupabase()),
}));

// Mock PDF report generator
vi.mock('@/lib/reports/pdf-generator', () => ({
  generatePDFReportData: vi.fn((tenantId: string, orgName: string, abn: string) => {
    // Simulate different opportunity values for different organizations
    const opportunities = {
      'tenant-1': { total: 150000, adjusted: 135000, rnd: 80000, deductions: 40000, losses: 10000, div7a: 5000 },
      'tenant-2': { total: 80000, adjusted: 72000, rnd: 30000, deductions: 30000, losses: 10000, div7a: 2000 },
      'tenant-3': { total: 50000, adjusted: 45000, rnd: 20000, deductions: 15000, losses: 8000, div7a: 2000 },
    };

    const data = opportunities[tenantId as keyof typeof opportunities] || {
      total: 0,
      adjusted: 0,
      rnd: 0,
      deductions: 0,
      losses: 0,
      div7a: 0,
    };

    return Promise.resolve({
      metadata: {
        reportId: `REP-${Date.now()}-${tenantId.substring(0, 8)}`,
        organizationName: orgName,
        abn,
        generatedAt: new Date(),
      },
      executiveSummary: {
        totalOpportunity: data.total,
        adjustedOpportunity: data.adjusted,
        breakdown: {
          rnd: data.rnd,
          deductions: data.deductions,
          losses: data.losses,
          div7a: data.div7a,
        },
        overallConfidence: 85,
      },
    });
  }),
}));

import { generateConsolidatedReport, formatCurrency, formatPercentage } from '@/lib/reports/consolidated-report-generator';

describe('Consolidated Report Generator', () => {
  let mockSupabase: SupabaseServiceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as unknown as SupabaseServiceClient;
  });

  describe('generateConsolidatedReport', () => {
    it('should generate consolidated report for multiple organizations', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      expect(report).toBeDefined();
      expect(report.metadata.accountantName).toBe('Test Accountant');
      expect(report.metadata.accountantEmail).toBe('accountant@test.com');
      expect(report.metadata.totalClients).toBe(3);
      expect(report.metadata.successfulReports).toBe(3);
      expect(report.metadata.failedReports).toBe(0);
    });

    it('should calculate correct portfolio summary totals', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      // Expected totals: 135000 + 72000 + 45000 = 252000
      expect(report.portfolioSummary.totalAdjustedOpportunity).toBe(252000);

      // Expected R&D total: 80000 + 30000 + 20000 = 130000
      expect(report.portfolioSummary.totalRndOpportunity).toBe(130000);

      // Expected deductions total: 40000 + 30000 + 15000 = 85000
      expect(report.portfolioSummary.totalDeductionOpportunity).toBe(85000);

      // Expected losses total: 10000 + 10000 + 8000 = 28000
      expect(report.portfolioSummary.totalLossRecovery).toBe(28000);

      // Expected Div 7A total: 5000 + 2000 + 2000 = 9000
      expect(report.portfolioSummary.totalDiv7aRisk).toBe(9000);
    });

    it('should calculate correct average opportunity per client', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      // Expected average: 252000 / 3 = 84000
      expect(report.portfolioSummary.averageOpportunityPerClient).toBe(84000);
    });

    it('should rank top clients correctly', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      expect(report.portfolioSummary.topClients).toHaveLength(3);
      expect(report.portfolioSummary.topClients[0].name).toBe('Test Corp 1');
      expect(report.portfolioSummary.topClients[0].opportunity).toBe(135000);
      expect(report.portfolioSummary.topClients[1].name).toBe('Test Corp 2');
      expect(report.portfolioSummary.topClients[1].opportunity).toBe(72000);
      expect(report.portfolioSummary.topClients[2].name).toBe('Test Corp 3');
      expect(report.portfolioSummary.topClients[2].opportunity).toBe(45000);
    });

    it('should categorize opportunity distribution correctly', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      // Test Corp 1: 135000 (above 100k)
      // Test Corp 2: 72000 (between 50k and 100k)
      // Test Corp 3: 45000 (between 20k and 50k)
      expect(report.portfolioSummary.opportunityDistribution.above100k).toBe(1);
      expect(report.portfolioSummary.opportunityDistribution.between50kAnd100k).toBe(1);
      expect(report.portfolioSummary.opportunityDistribution.between20kAnd50k).toBe(1);
      expect(report.portfolioSummary.opportunityDistribution.below20k).toBe(0);
    });

    it('should include all client reports', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      expect(report.clientReports).toHaveLength(3);
      expect(report.clientReports.every((r) => r.status === 'completed')).toBe(true);
    });

    it('should calculate insights correctly', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      // 3 clients * 2.5 hours = 7.5 hours, rounded = 8
      expect(report.insights.totalTimeSaved).toBe(8);

      // Average confidence: 85% for all three
      expect(report.insights.averageConfidence).toBe(85);

      // Critical action items (>50K): Test Corp 1 (135K) and Test Corp 2 (72K) = 2
      expect(report.insights.criticalActionItems).toBe(2);
    });

    it('should track generation metrics', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      expect(report.generationMetrics.clientsProcessed).toBe(3);
      expect(report.generationMetrics.parallelBatches).toBe(1); // 3 clients, batch size 5 = 1 batch
      expect(report.generationMetrics.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle different batch sizes', async () => {
      const report = await generateConsolidatedReport('test-accountant-id', mockSupabase, 2);

      expect(report.metadata.totalClients).toBe(3);
      // With batch size 2 and 3 clients, should have 2 batches
      expect(report.generationMetrics.parallelBatches).toBe(2);
    });

    it('should generate unique report IDs', async () => {
      const report1 = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);
      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));
      const report2 = await generateConsolidatedReport('test-accountant-id', mockSupabase, 5);

      expect(report1.metadata.reportId).not.toBe(report2.metadata.reportId);
      // Report ID format: CONS-{timestamp}-{first 8 chars of accountant user ID}
      expect(report1.metadata.reportId).toMatch(/^CONS-\d+-[a-zA-Z0-9-]{1,8}$/);
      expect(report2.metadata.reportId).toMatch(/^CONS-\d+-[a-zA-Z0-9-]{1,8}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle failed client reports gracefully', async () => {
      // Mock one organization to fail
      const { generatePDFReportData } = await import('@/lib/reports/pdf-generator');
      vi.mocked(generatePDFReportData).mockRejectedValueOnce(
        new Error('Failed to fetch data from Xero')
      );

      const supabase = createMockSupabase() as unknown as SupabaseServiceClient;
      const report = await generateConsolidatedReport('test-accountant-id', supabase, 5);

      // Should have 2 successful and 1 failed
      expect(report.metadata.totalClients).toBe(3);
      expect(report.metadata.successfulReports).toBe(2);
      expect(report.metadata.failedReports).toBe(1);

      const failedReport = report.clientReports.find((r) => r.status === 'failed');
      expect(failedReport).toBeDefined();
      expect(failedReport?.errorMessage).toContain('Failed to fetch data from Xero');
      expect(failedReport?.totalOpportunity).toBe(0);
      expect(failedReport?.adjustedOpportunity).toBe(0);
    });

    it('should throw error when no organizations found', async () => {
      // Create a mock supabase that returns empty organizations
      const emptySupabase = {
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: {
                        full_name: 'Test Accountant',
                        email: 'accountant@test.com',
                      },
                      error: null,
                    })
                  ),
                })),
              })),
            };
          }
          if (table === 'user_organization_access') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    })
                  ),
                })),
              })),
            };
          }
          return {};
        }),
      };

      await expect(generateConsolidatedReport('no-orgs-accountant', emptySupabase as unknown as SupabaseServiceClient, 5)).rejects.toThrow(
        'No client organizations found for this accountant'
      );
    });
  });

  describe('Formatting Functions', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(1234.56)).toBe('$1,235');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(-500)).toBe('-$500');
    });

    it('should format percentage correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(33.333333)).toBe('33.3%');
      expect(formatPercentage(100)).toBe('100.0%');
      expect(formatPercentage(0)).toBe('0.0%');
    });
  });
});
