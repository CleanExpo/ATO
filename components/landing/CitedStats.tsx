const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
} as const

const STATS = [
  {
    value: '$12.2B',
    label: 'R&D Tax Incentive claims in FY2022\u201323',
    source: 'ATO R&D Tax Incentive Statistics',
    sourceUrl: 'https://www.ato.gov.au/about-ato/research-and-statistics/in-detail/taxation-statistics/taxation-statistics-previous-editions',
    colour: SPECTRAL.emerald,
  },
  {
    value: '43.5%',
    label: 'Refundable offset rate for base rate entities under $20M turnover',
    source: 'Division 355 ITAA 1997',
    sourceUrl: 'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/r-and-d-tax-incentive',
    colour: SPECTRAL.cyan,
  },
  {
    value: '8.77%',
    label: 'Division 7A benchmark interest rate for FY2024\u201325',
    source: 'ATO Division 7A benchmark rate',
    sourceUrl: 'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/division-7a-private-company-loans-and-debt-forgiveness',
    colour: SPECTRAL.amber,
  },
  {
    value: '$20K',
    label: 'Instant asset write-off threshold for small business entities',
    source: 'Subdivision 328-D ITAA 1997',
    sourceUrl: 'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business',
    colour: SPECTRAL.red,
  },
] as const

export function CitedStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {STATS.map((stat) => (
        <figure
          key={stat.value}
          className="p-6 border-[0.5px] border-white/[0.08] rounded-sm text-center"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <p
            className="text-4xl font-mono font-light tabular-nums mb-3"
            style={{ color: stat.colour }}
          >
            {stat.value}
          </p>
          <figcaption className="text-sm text-white/45 leading-relaxed mb-3">
            {stat.label}
          </figcaption>
          <cite className="text-[10px] text-white/25 not-italic block">
            <a
              href={stat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/40 transition-colors underline underline-offset-2"
            >
              {stat.source}
            </a>
          </cite>
        </figure>
      ))}
    </div>
  )
}
