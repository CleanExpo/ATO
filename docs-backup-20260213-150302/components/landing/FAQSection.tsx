const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
} as const

const FAQ_ITEMS = [
  {
    question: 'How much can Australian businesses recover through R&D tax offsets?',
    answer:
      'Under Division 355 ITAA 1997, eligible Australian businesses with aggregated turnover under $20M can receive a refundable tax offset at the corporate tax rate plus 18.5% (43.5% for base rate entities at 25%). Our forensic analysis typically identifies $200K\u2013$500K in recoverable benefits across 5 financial years.',
  },
  {
    question: 'Is my Xero data safe with ATO Tax Optimizer?',
    answer:
      'Yes. We use read-only Xero OAuth access with AES-256-GCM encryption. Your accounting data is never modified. All infrastructure runs in Australian data centres (ap-southeast-2) with row-level security on every tenant\u2019s data.',
  },
  {
    question: 'Does this replace my tax agent?',
    answer:
      'No. ATO Tax Optimizer is an analytical tool, not a registered tax agent under the Tax Agent Services Act 2009 (TASA). All findings should be reviewed by a qualified tax professional before implementation. We recommend \u2014 they execute.',
  },
  {
    question: 'What data does the forensic analysis examine?',
    answer:
      'The platform analyses up to 5 years of Xero transaction data including profit & loss, balance sheet, journal entries, and bank transactions. It cross-references every line item against ATO legislation (ITAA 1997, ITAA 1936, FBTAA 1986) to identify misclassified deductions, eligible R&D activities, and Division 7A compliance gaps.',
  },
  {
    question: 'How long does the tax analysis take?',
    answer:
      'The AI-powered forensic scan processes approximately 2,400 transactions per hour. A typical 5-year analysis for an SME with moderate transaction volume completes within 2\u20134 hours. You\u2019ll receive prioritised findings ranked by dollar value with full legislation references.',
  },
  {
    question: 'Which Australian tax legislation does the platform reference?',
    answer:
      'Every finding includes specific ATO legislation references. Key Acts include Division 355 ITAA 1997 (R&D Tax Incentive), Section 8-1 ITAA 1997 (general deductions), Division 7A ITAA 1936 (private company loans), FBTAA 1986 (fringe benefits), and Subdivision 328-D ITAA 1997 (instant asset write-off).',
  },
  {
    question: 'Is my financial data stored in Australia?',
    answer:
      'Yes. All data is stored in Australian data centres (AWS ap-southeast-2, Sydney). We use Supabase with PostgreSQL hosted in the Sydney region, and Vercel edge functions deployed to syd1. Your financial data never leaves Australian jurisdiction.',
  },
] as const

export function FAQSection() {
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.question}
          className="group border-[0.5px] border-white/[0.08] rounded-sm overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-left text-white/80 hover:text-white transition-colors duration-200 [&::-webkit-details-marker]:hidden">
            <span className="text-[15px] font-light leading-snug">{item.question}</span>
            <span
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border-[0.5px] border-white/[0.1] text-white/30 group-open:rotate-45 transition-transform duration-300"
              aria-hidden="true"
            >
              +
            </span>
          </summary>
          <div className="px-6 pb-5">
            <p className="text-sm text-white/45 leading-relaxed">{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
