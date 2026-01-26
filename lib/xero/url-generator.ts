/**
 * Xero URL Generator
 *
 * Generates deep links to open transactions directly in Xero.
 * URL formats differ by transaction type.
 *
 * @example
 * const url = generateXeroUrl({
 *   transactionId: 'abc-123',
 *   transactionType: 'BANK'
 * });
 * // Returns: https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=abc-123
 */

export type XeroTransactionType = 'ACCPAY' | 'ACCREC' | 'BANK' | 'SPEND' | 'RECEIVE';

export interface XeroUrlOptions {
  transactionId: string;
  transactionType: string;
  /** Raw data from cache - used to determine invoice type (payable vs receivable) */
  rawData?: Record<string, unknown>;
}

const XERO_BASE_URL = 'https://go.xero.com';

/**
 * Generate a Xero deep link URL for a transaction
 *
 * @param options - Transaction details including ID and type
 * @returns URL string to open in Xero, or null if type is unknown
 */
export function generateXeroUrl(options: XeroUrlOptions): string | null {
  const { transactionId, transactionType, rawData } = options;

  if (!transactionId) return null;

  // Normalise transaction type to uppercase
  const type = transactionType?.toUpperCase() || '';

  switch (type) {
    case 'BANK':
    case 'SPEND':
    case 'RECEIVE':
      // Bank transactions use bankTransactionID parameter
      return `${XERO_BASE_URL}/Bank/ViewTransaction.aspx?bankTransactionID=${transactionId}`;

    case 'ACCPAY':
      // Accounts Payable - Bills from suppliers
      return `${XERO_BASE_URL}/AccountsPayable/View.aspx?InvoiceID=${transactionId}`;

    case 'ACCREC':
      // Accounts Receivable - Invoices to customers
      return `${XERO_BASE_URL}/AccountsReceivable/View.aspx?InvoiceID=${transactionId}`;

    default:
      // Attempt to determine type from raw data structure
      if (rawData) {
        // Check for bank transaction ID in raw data
        if (rawData.bankTransactionID) {
          return `${XERO_BASE_URL}/Bank/ViewTransaction.aspx?bankTransactionID=${transactionId}`;
        }

        // Check for invoice ID in raw data
        if (rawData.invoiceID) {
          const invoiceType = rawData.type as string;

          // Determine if payable or receivable based on type field
          if (invoiceType?.includes('PAY') || invoiceType === 'ACCPAY' || invoiceType === 'BILL') {
            return `${XERO_BASE_URL}/AccountsPayable/View.aspx?InvoiceID=${transactionId}`;
          }

          // Default to receivable for other invoice types
          return `${XERO_BASE_URL}/AccountsReceivable/View.aspx?InvoiceID=${transactionId}`;
        }

        // Check the status field which often indicates transaction type
        const status = rawData.status as string;
        if (status === 'AUTHORISED' || status === 'PAID' || status === 'VOIDED') {
          // Likely an invoice
          const invoiceType = rawData.type as string;
          if (invoiceType?.includes('PAY') || invoiceType === 'ACCPAY') {
            return `${XERO_BASE_URL}/AccountsPayable/View.aspx?InvoiceID=${transactionId}`;
          }
          return `${XERO_BASE_URL}/AccountsReceivable/View.aspx?InvoiceID=${transactionId}`;
        }
      }

      // Unknown type - return null
      console.warn(`Unknown Xero transaction type: ${type} for ID: ${transactionId}`);
      return null;
  }
}

/**
 * Batch generate Xero URLs for multiple transactions
 *
 * @param transactions - Array of transaction details
 * @returns Map of transaction ID to URL (or null if unknown type)
 */
export function generateXeroUrls(
  transactions: Array<{
    transactionId: string;
    transactionType: string;
    rawData?: Record<string, unknown>;
  }>
): Map<string, string | null> {
  const urlMap = new Map<string, string | null>();

  for (const txn of transactions) {
    urlMap.set(
      txn.transactionId,
      generateXeroUrl({
        transactionId: txn.transactionId,
        transactionType: txn.transactionType,
        rawData: txn.rawData,
      })
    );
  }

  return urlMap;
}

/**
 * Generate a Xero organisation dashboard URL
 *
 * @param shortCode - Xero organisation short code (e.g., '!TNjPw')
 * @returns URL to the organisation dashboard
 */
export function generateXeroOrgUrl(shortCode?: string): string {
  if (shortCode) {
    return `${XERO_BASE_URL}/organisationlogin/default.aspx?shortcode=${shortCode}`;
  }
  return `${XERO_BASE_URL}/Dashboard/`;
}

/**
 * Generate a Xero reports URL
 *
 * @param reportType - Type of report (e.g., 'ProfitAndLoss', 'BalanceSheet')
 * @returns URL to the report in Xero
 */
export function generateXeroReportUrl(
  reportType: 'ProfitAndLoss' | 'BalanceSheet' | 'TrialBalance' | 'AgedReceivables' | 'AgedPayables'
): string {
  const reportPaths: Record<string, string> = {
    ProfitAndLoss: '/Reports/Report.aspx?reportId=ProfitAndLoss',
    BalanceSheet: '/Reports/Report.aspx?reportId=BalanceSheet',
    TrialBalance: '/Reports/Report.aspx?reportId=TrialBalance',
    AgedReceivables: '/Reports/Report.aspx?reportId=AgedReceivables',
    AgedPayables: '/Reports/Report.aspx?reportId=AgedPayables',
  };

  return `${XERO_BASE_URL}${reportPaths[reportType] || '/Reports/'}`;
}
