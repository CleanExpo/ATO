/**
 * MYOB AccountRight API Response Types
 *
 * Interfaces for raw MYOB API responses used by the MYOB adapter
 * normalisation functions. These replace `any` typed parameters.
 *
 * API Reference: https://developer.myob.com/api/accountright/v2/
 */

export interface MYOBLine {
  RowID?: string
  Description?: string
  Total?: number
  Tax?: { Amount?: number }
  TaxCode?: { Code?: string; Rate?: number }
  Account?: { UID?: string; DisplayID?: string; Name?: string }
  UnitCount?: number
  UnitPrice?: number
  DiscountPercent?: number
  ShipQuantity?: number
  BillQuantity?: number
  Item?: { UID?: string; Number?: string; Name?: string }
  Job?: { UID?: string; Number?: string; Name?: string }
  TaxAmount?: number
  Amount?: number
  IsCredit?: boolean
  Memo?: string
}

export interface MYOBAddress {
  Location?: number
  Street?: string
  City?: string
  State?: string
  PostCode?: string
  Country?: string
  Email?: string
  Phone1?: string
  Phone2?: string
  Phone3?: string
  Fax?: string
  Website?: string
}

export interface MYOBContact {
  UID?: string
  CompanyName?: string
  FirstName?: string
  LastName?: string
  DisplayID?: string
  IsActive?: boolean
  Addresses?: MYOBAddress[]
  Notes?: string
  Type?: string
  Email?: string
  ABN?: string
}

export interface MYOBInvoice {
  UID?: string
  Number?: string
  Date?: string
  DueDate?: string
  PromisedDate?: string
  Status?: string
  Subtotal?: number
  TotalTax?: number
  TotalAmount?: number
  ForeignCurrency?: { Code?: string; CurrencyRate?: number }
  Currency?: { Code?: string; ExchangeRate?: number }
  Terms?: { PaymentIsDue?: string; BalanceDueDate?: string }
  IsTaxInclusive?: boolean
  Lines?: MYOBLine[]
  Customer?: MYOBContact
  Supplier?: MYOBContact
  JournalMemo?: string
  Comment?: string
  ShipToAddress?: string
  URI?: string
  LastModified?: string
  DateOccurred?: string
  InvoiceType?: string
}

export interface MYOBBankTransaction {
  UID?: string
  Date?: string
  StatementText?: string
  Description?: string
  Status?: string
  Lines?: MYOBLine[]
  IsReconciled?: boolean
  Amount?: number
  ChequePrintingID?: string
  Memo?: string
  URI?: string
  PayFrom?: { Account?: { UID?: string; DisplayID?: string; Name?: string } }
  PayTo?: { Account?: { UID?: string; DisplayID?: string; Name?: string } }
  Contact?: MYOBContact
  Payee?: MYOBContact
  PaymentNumber?: string
  ReceiptNumber?: string
  LastModified?: string
}

export interface MYOBGeneralJournal {
  UID?: string
  DisplayID?: string
  DateOccurred?: string
  Memo?: string
  GSTReportingMethod?: string
  IsYearEndAdjustment?: boolean
  Lines?: MYOBLine[]
  URI?: string
  LastModified?: string
}

export interface MYOBAccount {
  UID?: string
  DisplayID?: string
  Name?: string
  Classification?: string
  Type?: string
  Number?: number
  Description?: string
  IsActive?: boolean
  Level?: number
  OpeningBalance?: number
  CurrentBalance?: number
  IsHeader?: boolean
  URI?: string
  TaxCode?: { Code?: string }
  ParentAccount?: { UID?: string; DisplayID?: string; Name?: string }
}
