import { XeroClient, TokenSet } from 'xero-node'

/** Minimal token shape accepted by isTokenExpired and refreshXeroTokens */
export type TokenSetInput = Pick<TokenSet, 'access_token' | 'refresh_token' | 'expires_at'>
import { withRetry } from '@/lib/xero/retry'
import { createLogger } from '@/lib/logger'

const log = createLogger('xero:client')

// Xero OAuth 2.0 Scopes
// Read: accounting data | Write: files & attachments only
export const XERO_SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'accounting.settings.read',
    'accounting.transactions.read',
    'accounting.reports.read',
    'accounting.contacts.read',
    'accounting.attachments',       // Attach findings to transactions
    'files',                        // Upload reports to Xero Files
    'assets.read',                  // Fixed asset register (Phase 1.1)
    'payroll.employees.read',       // Employee master data (Phase 1.2)
    'payroll.payruns.read',         // Payroll transactions (Phase 1.2)
    'payroll.timesheets.read',      // Timesheet data (Phase 1.2)
].join(' ')

// Create Xero client instance
// Pass state when handling callback to allow SDK validation
type CreateXeroClientOptions = {
    state?: string
    baseUrl?: string
}

function resolveBaseUrl(override?: string): string {
    // Use override if provided, otherwise resolve from environment
    // Always trim to guard against stray whitespace/CRLF in env vars
    if (override) {
        return override.trim().replace(/\/+$/, '')
    }

    // Try explicit base URL first
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/+$/, '')
    }

    // Vercel deployment URL
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL.trim()}`
    }

    // Local development fallback
    const port = process.env.PORT || '3000'
    return `http://localhost:${port}`
}

export function createXeroClient(options: CreateXeroClientOptions = {}): XeroClient {
    // Get credentials directly from environment (trim to guard against stray whitespace/CRLF)
    const clientId = process.env.XERO_CLIENT_ID?.trim()
    const clientSecret = process.env.XERO_CLIENT_SECRET?.trim()

    if (!clientId || !clientSecret) {
        throw new Error(
            'Missing Xero OAuth credentials. Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.'
        )
    }

    const baseUrl = resolveBaseUrl(options.baseUrl)

    log.info('Xero Client initialized', { baseUrl })

    try {
        return new XeroClient({
            clientId,
            clientSecret,
            redirectUris: [`${baseUrl}/api/auth/xero/callback`],
            scopes: XERO_SCOPES.split(' '),
            httpTimeout: 30000,
            state: options.state,
        })
    } catch (error) {
        console.error('Failed to create Xero client:', error)
        throw new Error(
            'Xero client initialization failed. Please check your XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.'
        )
    }
}

// Validate token set structure
export function isValidTokenSet(tokens: unknown): tokens is TokenSet {
    if (!tokens || typeof tokens !== 'object') return false
    const t = tokens as Record<string, unknown>
    return (
        typeof t.access_token === 'string' &&
        typeof t.refresh_token === 'string' &&
        typeof t.expires_at === 'number'
    )
}

// Check if tokens are expired or about to expire (5 min buffer)
export function isTokenExpired(tokens: TokenSetInput): boolean {
    const expiresAt = tokens.expires_at || 0
    const now = Math.floor(Date.now() / 1000)
    const buffer = 5 * 60 // 5 minutes
    return expiresAt - buffer <= now
}

// Refresh Xero tokens with retry logic
export async function refreshXeroTokens(tokens: TokenSetInput, baseUrl?: string): Promise<TokenSet> {
    return withRetry(
        async () => {
            const client = createXeroClient({ baseUrl })
            await client.initialize()
            client.setTokenSet(tokens as TokenSet)
            const newTokens = await client.refreshToken()
            return newTokens
        },
        {
            maxAttempts: 3,
            timeoutMs: 30000, // 30 second timeout
            initialBackoffMs: 1000,
            onRetry: (attempt, error) => {
                console.warn(`Retrying Xero token refresh (attempt ${attempt}):`, error)
            },
        }
    )
}

// Types for Xero API responses
export interface XeroTenant {
    id: string
    authEventId: string
    tenantId: string
    tenantType: string
    tenantName: string
    createdDateUtc: string
    updatedDateUtc: string
}

export interface XeroOrganization {
    name: string
    legalName?: string
    shortCode: string
    version: string
    organisationType: string
    baseCurrency: string
    countryCode: string
    isDemoCompany: boolean
    organisationStatus: string
    registrationNumber?: string
    taxNumber?: string
    financialYearEndDay: number
    financialYearEndMonth: number
}

// Fixed Assets (Phase 1.1 - ATODE Integration)
export interface XeroAsset {
    assetId: string
    assetName: string
    assetNumber?: string
    purchaseDate: string
    purchasePrice: number
    disposalDate?: string
    disposalPrice?: number
    assetStatus: 'Draft' | 'Registered' | 'Disposed'
    warrantyExpiryDate?: string
    serialNumber?: string
    assetType?: {
        assetTypeId: string
        assetTypeName: string
    }
    bookDepreciationSettings?: {
        depreciationMethod: 'StraightLine' | 'DiminishingValue100' | 'DiminishingValue150' | 'DiminishingValue200' | 'FullDepreciation' | 'None'
        averagingMethod: 'FullMonth' | 'ActualDays'
        depreciationRate?: number
        effectiveLifeYears?: number
        depreciationCalculationMethod?: 'Rate' | 'Life' | 'None'
    }
    bookDepreciationDetail?: {
        currentCapitalGain?: number
        currentGainLoss?: number
        depreciationStartDate?: string
        costLimit?: number
        residualValue?: number
        priorAccumDepreciationAmount?: number
        currentAccumDepreciationAmount?: number
    }
    accountingBookValue?: number
}

// Normalized Asset (ATODE Internal Format)
export interface NormalizedAsset {
    asset_id: string
    asset_name: string
    asset_number?: string
    purchase_date: string // ISO 8601
    purchase_price: number
    disposal_date?: string // ISO 8601
    disposal_price?: number
    asset_type: string
    depreciation_method: 'Prime Cost' | 'Diminishing Value' | 'Full Depreciation' | 'None'
    effective_life?: number // Years
    depreciation_rate?: number // Annual rate (decimal)
    accumulated_depreciation: number
    book_value: number
    pool_type?: string // 'Low-value pool' | 'SB pool' | null
    status: 'Active' | 'Disposed' | 'Draft'
}

// Payroll (Phase 1.2 - ATODE Integration)
export interface XeroEmployee {
    employeeID: string
    firstName: string
    lastName: string
    email?: string
    dateOfBirth?: string
    gender?: string
    phone?: string
    mobile?: string
    startDate?: string
    endDate?: string
    payrollCalendarID?: string
    jobTitle?: string
    classification?: string
    employeeGroupName?: string
    isAuthorisedToApproveLeave?: boolean
    isAuthorisedToApproveTimesheets?: boolean
    status?: 'ACTIVE' | 'TERMINATED'
}

export interface XeroPayRun {
    payRunID: string
    payRunStatus: 'DRAFT' | 'POSTED'
    payRunType: 'SCHEDULED' | 'UNSCHEDULED'
    payrollCalendarID: string
    periodStartDate: string
    periodEndDate: string
    paymentDate: string
    totalWages: number
    totalTax: number
    totalSuper: number
    totalReimbursement: number
    totalDeduction: number
    totalNetPay: number
    payslips?: XeroPayslip[]
}

export interface XeroPayslip {
    employeeID: string
    payslipID: string
    firstName: string
    lastName: string
    wages: number
    tax: number
    super: number
    reimbursements: number
    deductions: number
    netPay: number
}

export interface XeroSuperFund {
    superFundID: string
    type: 'REGULATED' | 'SMSF'
    name: string
    abn?: string
    bsb?: string
    accountNumber?: string
    accountName?: string
    electronicServiceAddress?: string
    employerNumber?: string
}

// Normalized Payroll (ATODE Internal Format)
export interface NormalizedEmployee {
    employee_id: string
    first_name: string
    last_name: string
    email?: string
    start_date?: string
    end_date?: string
    job_title?: string
    status: 'active' | 'terminated'
}

export interface NormalizedPayRun {
    pay_run_id: string
    period_start_date: string
    period_end_date: string
    payment_date: string
    total_wages: number
    total_tax: number
    total_super: number
    total_deductions: number
    total_net_pay: number
    employee_count: number
    status: 'draft' | 'posted'
}

export interface NormalizedSuperContribution {
    employee_id: string
    employee_name: string
    period_start_date: string
    period_end_date: string
    super_amount: number
    super_fund_id?: string
    super_fund_name?: string
    contribution_type: 'SG' | 'salary_sacrifice' | 'employer_additional'
}

// Contacts (Phase 1.3 - ATODE Integration)
export interface XeroContact {
    contactID: string
    contactStatus?: 'ACTIVE' | 'ARCHIVED' | 'GDPRREQUEST'
    name: string
    firstName?: string
    lastName?: string
    emailAddress?: string
    taxNumber?: string // ABN for Australian entities
    accountNumber?: string
    contactPersons?: Array<{
        firstName?: string
        lastName?: string
        emailAddress?: string
        includeInEmails?: boolean
    }>
    addresses?: Array<{
        addressType: 'POBOX' | 'STREET'
        addressLine1?: string
        addressLine2?: string
        addressLine3?: string
        addressLine4?: string
        city?: string
        region?: string // State/Territory
        postalCode?: string
        country?: string
        attentionTo?: string
    }>
    phones?: Array<{
        phoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX'
        phoneNumber?: string
        phoneAreaCode?: string
        phoneCountryCode?: string
    }>
    isSupplier?: boolean
    isCustomer?: boolean
    defaultCurrency?: string
    purchasesDefaultAccountCode?: string
    salesDefaultAccountCode?: string
    brandingTheme?: string
    balances?: {
        accountsReceivable?: {
            outstanding?: number
            overdue?: number
        }
        accountsPayable?: {
            outstanding?: number
            overdue?: number
        }
    }
}

// Normalized Contact (ATODE Internal Format)
export interface NormalizedContact {
    contact_id: string
    name: string
    first_name?: string
    last_name?: string
    email?: string
    abn?: string // Australian Business Number (from taxNumber)
    contact_type: 'customer' | 'supplier' | 'both' | 'other'
    entity_type?: 'individual' | 'company' | 'trust' | 'partnership' // Inferred from ABN structure
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    phone?: string
    mobile?: string
    status: 'active' | 'archived'
    accounts_receivable_balance?: number
    accounts_payable_balance?: number
    is_related_party?: boolean // Flag for trust/Division 7A analysis
}

// BAS (Business Activity Statement) (Phase 1.4 - ATODE Integration)
export interface XeroBASReport {
    reportID: string
    reportName: string
    reportType: string
    reportTitles: string[]
    reportDate: string
    updatedDateUTC: string
    fields?: Array<{
        fieldID: string
        description: string
        value: number
    }>
}

// Normalized BAS (ATODE Internal Format)
export interface NormalizedBAS {
    report_id: string
    period_start_date: string
    period_end_date: string
    lodgement_date?: string

    // GST fields (G1-G11)
    g1_total_sales?: number // Total Sales
    g2_export_sales?: number // Export Sales
    g3_other_gst_free_sales?: number // Other GST-free Sales
    g4_input_taxed_sales?: number // Input Taxed Sales
    g10_capital_purchases?: number // Capital Purchases
    g11_non_capital_purchases?: number // Non-Capital Purchases

    // PAYG Withholding (W1-W2)
    w1_total_salary_wages?: number // Total Salary and Wages
    w2_withheld_amounts?: number // Amounts Withheld

    // PAYG Instalments (T1-T2)
    t1_instalment_income?: number // Instalment Income
    t2_instalment_amount?: number // Instalment Amount

    // Calculated fields
    gst_on_sales?: number // G1 × 1/11
    gst_on_purchases?: number // (G10 + G11) × 1/11
    net_gst?: number // GST on Sales - GST on Purchases

    status: 'draft' | 'lodged'
}

// Inventory Items (Phase 1.5 - ATODE Integration)
export interface XeroItem {
    itemID: string
    code: string
    name?: string
    isSold?: boolean
    isPurchased?: boolean
    description?: string
    purchaseDescription?: string
    inventoryAssetAccountCode?: string
    salesDetails?: {
        unitPrice?: number
        accountCode?: string
        taxType?: string
    }
    purchaseDetails?: {
        unitPrice?: number
        accountCode?: string
        taxType?: string
    }
    quantityOnHand?: number
    totalCostPool?: number
    isTrackedAsInventory?: boolean
}

// Normalized Inventory Item (ATODE Internal Format)
export interface NormalizedInventoryItem {
    item_id: string
    item_code: string
    item_name?: string
    description?: string

    // Tracking
    is_tracked: boolean
    quantity_on_hand?: number

    // Valuation
    cost_price?: number // Purchase unit price
    sell_price?: number // Sales unit price
    total_cost_pool?: number // Total value of inventory on hand

    // Accounting
    inventory_asset_account?: string
    cogs_account?: string // Cost of Goods Sold account
    sales_account?: string

    // Tax
    purchase_tax_type?: string
    sales_tax_type?: string

    // Classification
    is_sold: boolean
    is_purchased: boolean

    status: 'active' | 'inactive'
}
