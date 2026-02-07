export function SoftwareApplicationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ATO Tax Optimizer',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '995',
      priceCurrency: 'AUD',
    },
    description:
      'AI-powered forensic tax analysis for Australian businesses. Identifies R&D tax offsets, unclaimed deductions, and Division 7A compliance gaps from Xero data.',
    areaServed: {
      '@type': 'Country',
      name: 'Australia',
    },
    featureList: [
      'Forensic analysis of 5 years of Xero transaction data',
      'R&D Tax Incentive eligibility assessment',
      'Division 7A loan compliance monitoring',
      'Unclaimed deduction discovery',
      'ATO legislation references on every finding',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function FAQPageSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much can Australian businesses recover through R&D tax offsets?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Under Division 355 ITAA 1997, eligible Australian businesses with turnover under $20M can receive a refundable tax offset of up to 43.5% on qualifying R&D expenditure. Our forensic analysis typically identifies $200K-$500K in recoverable benefits across 5 financial years.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is my Xero data safe with ATO Tax Optimizer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. We use read-only Xero OAuth access with AES-256-GCM encryption. Your accounting data is never modified. All infrastructure runs in Australian data centres (ap-southeast-2).',
        },
      },
      {
        '@type': 'Question',
        name: 'Does this replace my tax agent?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. ATO Tax Optimizer is an analytical tool, not a registered tax agent under the Tax Agent Services Act 2009. All findings should be reviewed by a qualified tax professional before implementation.',
        },
      },
      {
        '@type': 'Question',
        name: 'What data does the forensic analysis examine?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The platform analyses up to 5 years of Xero transaction data including profit & loss, balance sheet, journal entries, and bank transactions. It cross-references every line item against ATO legislation to identify misclassified deductions, eligible R&D activities, and Division 7A compliance gaps.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does the tax analysis take?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The AI-powered forensic scan processes approximately 2,400 transactions per hour. A typical 5-year analysis for an SME completes within 2-4 hours with prioritised findings ranked by dollar value.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which Australian tax legislation does the platform reference?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every finding includes specific ATO legislation references including Division 355 ITAA 1997 (R&D), Section 8-1 ITAA 1997 (general deductions), Division 7A ITAA 1936 (private company loans), FBTAA 1986 (fringe benefits), and Subdivision 328-D ITAA 1997 (instant asset write-off).',
        },
      },
      {
        '@type': 'Question',
        name: 'Is my financial data stored in Australia?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All data is stored in Australian data centres (AWS ap-southeast-2, Sydney) with row-level security. Your financial data never leaves Australian jurisdiction.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ATO Tax Optimizer',
    url: 'https://atotaxoptimizer.com.au',
    areaServed: {
      '@type': 'Country',
      name: 'Australia',
    },
    knowsAbout: [
      'R&D Tax Incentive (Division 355 ITAA 1997)',
      'Division 7A Compliance',
      'Australian Business Taxation',
      'Tax Deduction Recovery',
      'Xero Accounting Integration',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function BreadcrumbSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://atotaxoptimizer.com.au',
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
