/**
 * Chart Data Builder
 *
 * Prepares chart data from forensic analysis results for visualization.
 * Creates data structures optimized for AI-generated charts.
 */

export interface ChartData {
    title: string
    type: 'bar' | 'line' | 'pie' | 'donut' | 'stacked-bar' | 'waterfall'
    data: {
        labels: string[]
        datasets: Array<{
            label: string
            data: number[]
            color?: string
        }>
    }
    description?: string
}

/**
 * Build R&D Expenditure by Year chart
 */
export function buildRndExpenditureChart(
    rndData: Array<{
        financialYear: string
        totalExpenditure: number
        estimatedOffset: number
    }>
): ChartData {
    return {
        title: 'R&D Expenditure & Tax Offset by Financial Year',
        type: 'stacked-bar',
        data: {
            labels: rndData.map((d) => d.financialYear),
            datasets: [
                {
                    label: 'R&D Expenditure',
                    data: rndData.map((d) => d.totalExpenditure),
                    color: '#1e40af', // Blue
                },
                {
                    label: 'Estimated 43.5% Offset',
                    data: rndData.map((d) => d.estimatedOffset),
                    color: '#16a34a', // Green
                },
            ],
        },
        description: 'Division 355 R&D Tax Incentive opportunity across 5 years',
    }
}

/**
 * Build Deductions by Category chart
 */
export function buildDeductionsByCategoryChart(
    deductions: Array<{
        category: string
        totalAmount: number
        claimableAmount: number
    }>
): ChartData {
    // Sort by claimable amount descending, take top 10
    const topDeductions = deductions
        .sort((a, b) => b.claimableAmount - a.claimableAmount)
        .slice(0, 10)

    return {
        title: 'Top 10 Deduction Opportunities by Category',
        type: 'bar',
        data: {
            labels: topDeductions.map((d) => d.category),
            datasets: [
                {
                    label: 'Claimable Amount ($)',
                    data: topDeductions.map((d) => d.claimableAmount),
                    color: '#16a34a', // Green
                },
            ],
        },
        description: 'Division 8 general deduction opportunities',
    }
}

/**
 * Build Tax Opportunity by Area pie chart
 */
export function buildTaxOpportunityPieChart(opportunities: {
    rnd: number
    deductions: number
    losses: number
    div7a: number
}): ChartData {
    return {
        title: 'Total Tax Opportunity by Area',
        type: 'pie',
        data: {
            labels: [
                'R&D Tax Incentive',
                'General Deductions',
                'Loss Carry-Forward',
                'Division 7A Optimization',
            ],
            datasets: [
                {
                    label: 'Opportunity ($)',
                    data: [
                        opportunities.rnd,
                        opportunities.deductions,
                        opportunities.losses,
                        opportunities.div7a,
                    ],
                    color: '', // Will use auto colors from palette
                },
            ],
        },
        description: 'Breakdown of total identified tax savings across 4 key areas',
    }
}

/**
 * Build Loss Position Waterfall chart
 */
export function buildLossPositionWaterfallChart(
    lossData: Array<{
        financialYear: string
        openingBalance: number
        generated: number
        utilized: number
        closingBalance: number
    }>
): ChartData {
    return {
        title: 'Tax Loss Position - 5 Year Movement',
        type: 'waterfall',
        data: {
            labels: lossData.map((d) => d.financialYear),
            datasets: [
                {
                    label: 'Opening Balance',
                    data: lossData.map((d) => d.openingBalance),
                    color: '#3b82f6', // Light blue
                },
                {
                    label: 'Losses Generated',
                    data: lossData.map((d) => d.generated),
                    color: '#dc2626', // Red
                },
                {
                    label: 'Losses Utilized',
                    data: lossData.map((d) => d.utilized),
                    color: '#16a34a', // Green
                },
                {
                    label: 'Closing Balance',
                    data: lossData.map((d) => d.closingBalance),
                    color: '#1e40af', // Dark blue
                },
            ],
        },
        description: 'Division 36/165 tax loss movements and optimization opportunities',
    }
}

/**
 * Build Confidence Distribution chart
 */
export function buildConfidenceDistributionChart(confidenceData: {
    high: number // 80-100%
    medium: number // 60-80%
    low: number // <60%
}): ChartData {
    return {
        title: 'Analysis Confidence Distribution',
        type: 'donut',
        data: {
            labels: [
                'High Confidence (80-100%)',
                'Medium Confidence (60-80%)',
                'Low Confidence (<60%)',
            ],
            datasets: [
                {
                    label: 'Transaction Count',
                    data: [confidenceData.high, confidenceData.medium, confidenceData.low],
                    color: '', // Auto palette
                },
            ],
        },
        description: 'AI analysis confidence levels across all assessed transactions',
    }
}

/**
 * Build Recommendation Priority chart
 */
export function buildRecommendationPriorityChart(priorities: {
    critical: number
    high: number
    medium: number
    low: number
}): ChartData {
    return {
        title: 'Recommendations by Priority Level',
        type: 'bar',
        data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [
                {
                    label: 'Number of Recommendations',
                    data: [priorities.critical, priorities.high, priorities.medium, priorities.low],
                    color: '#ea580c', // Orange
                },
            ],
        },
        description: 'Prioritized action items requiring attention',
    }
}

/**
 * Build Year-over-Year Comparison chart
 */
export function buildYearOverYearComparisonChart(
    yearlyData: Array<{
        year: string
        income: number
        expenses: number
        taxableIncome: number
    }>
): ChartData {
    return {
        title: 'Financial Position - 5 Year Trend',
        type: 'line',
        data: {
            labels: yearlyData.map((d) => d.year),
            datasets: [
                {
                    label: 'Income ($)',
                    data: yearlyData.map((d) => d.income),
                    color: '#16a34a', // Green
                },
                {
                    label: 'Expenses ($)',
                    data: yearlyData.map((d) => d.expenses),
                    color: '#dc2626', // Red
                },
                {
                    label: 'Taxable Income ($)',
                    data: yearlyData.map((d) => d.taxableIncome),
                    color: '#1e40af', // Blue
                },
            ],
        },
        description: 'Business performance trends across 5 financial years',
    }
}

/**
 * Build Division 7A Risk Assessment chart
 */
export function buildDiv7aRiskChart(
    riskData: Array<{
        loanType: string
        amount: number
        riskLevel: 'High' | 'Medium' | 'Low'
    }>
): ChartData {
    return {
        title: 'Division 7A Loan Analysis',
        type: 'bar',
        data: {
            labels: riskData.map((d) => d.loanType),
            datasets: [
                {
                    label: 'Loan Amount ($)',
                    data: riskData.map((d) => d.amount),
                    color: '#dc2626', // Red for risk
                },
            ],
        },
        description: 'Identified shareholder loans requiring Division 7A compliance',
    }
}

/**
 * Build all standard report charts
 */
export async function buildStandardReportCharts(analysisResults: {
    rnd: Array<{ financialYear: string; totalExpenditure: number; estimatedOffset: number }>
    deductions: Array<{ category: string; totalAmount: number; claimableAmount: number }>
    opportunities: { rnd: number; deductions: number; losses: number; div7a: number }
    confidence: { high: number; medium: number; low: number }
    priorities: { critical: number; high: number; medium: number; low: number }
}): Promise<ChartData[]> {
    const charts: ChartData[] = []

    // 1. Tax Opportunity Pie Chart (Executive Summary)
    charts.push(buildTaxOpportunityPieChart(analysisResults.opportunities))

    // 2. R&D Expenditure by Year
    if (analysisResults.rnd.length > 0) {
        charts.push(buildRndExpenditureChart(analysisResults.rnd))
    }

    // 3. Deductions by Category
    if (analysisResults.deductions.length > 0) {
        charts.push(buildDeductionsByCategoryChart(analysisResults.deductions))
    }

    // 4. Confidence Distribution
    charts.push(buildConfidenceDistributionChart(analysisResults.confidence))

    // 5. Recommendation Priorities
    charts.push(buildRecommendationPriorityChart(analysisResults.priorities))

    return charts
}
