import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSBEEligibility } from '@/lib/calculators/sbe-checker';
import { getCurrentTaxRates } from '@/lib/tax-data/cache-manager';

// Mock the tax rates fetcher
vi.mock('@/lib/tax-data/cache-manager', () => ({
    getCurrentTaxRates: vi.fn(),
}));

describe('SBE Eligibility Checker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('identifies an eligible small business entity', async () => {
        // Mock tax rates response
        (getCurrentTaxRates as any).mockResolvedValue({
            sources: { corporateTax: 'ATO_MOCK' }
        });

        const entities = [
            { name: 'Test Entity', turnover: 5_000_000, relationship: 'primary' as const }
        ];

        const result = await checkSBEEligibility(entities);

        expect(result.isPrimaryEntityEligible).toBe(true);
        expect(result.aggregatedTurnover).toBe(5_000_000);
        expect(result.eligibleConcessions.length).toBeGreaterThan(0);
        expect(result.warnings).toHaveLength(0);
    });

    it('identifies an ineligible business entity exceeding threshold', async () => {
        (getCurrentTaxRates as any).mockResolvedValue({
            sources: { corporateTax: 'ATO_MOCK' }
        });

        const entities = [
            { name: 'Large Entity', turnover: 15_000_000, relationship: 'primary' as const }
        ];

        const result = await checkSBEEligibility(entities);

        expect(result.isPrimaryEntityEligible).toBe(false);
        expect(result.aggregatedTurnover).toBe(15_000_000);
        expect(result.ineligibleConcessions.some(c => c.name === 'Simplified Depreciation (Pool)')).toBe(true);
    });

    it('aggregates turnover correctly from multiple entities', async () => {
        (getCurrentTaxRates as any).mockResolvedValue({
            sources: { corporateTax: 'ATO_MOCK' }
        });

        const entities = [
            { name: 'Parent', turnover: 6_000_000, relationship: 'primary' as const },
            { name: 'Child', turnover: 5_000_000, relationship: 'connected' as const }
        ];

        const result = await checkSBEEligibility(entities);

        expect(result.aggregatedTurnover).toBe(11_000_000);
        expect(result.isPrimaryEntityEligible).toBe(false); // Over $10MB
    });

    it('warns when turnover is close to the threshold', async () => {
        (getCurrentTaxRates as any).mockResolvedValue({
            sources: { corporateTax: 'ATO_MOCK' }
        });

        const entities = [
            { name: 'Borderline Entity', turnover: 9_600_000, relationship: 'primary' as const }
        ];

        const result = await checkSBEEligibility(entities);

        expect(result.isPrimaryEntityEligible).toBe(true);
        expect(result.warnings.some(w => w.includes('below $10M threshold'))).toBe(true);
    });

    it('handles errors in tax rate fetching gracefully', async () => {
        (getCurrentTaxRates as any).mockRejectedValue(new Error('Network error'));

        const entities = [
            { name: 'Test Entity', turnover: 1_000_000, relationship: 'primary' as const }
        ];

        const result = await checkSBEEligibility(entities);

        expect(result.isPrimaryEntityEligible).toBe(true);
        expect(result.taxRateSource).toBe('ATO_FALLBACK');
    });
});
