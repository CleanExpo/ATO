'use client'

/**
 * PricingTable — Jurisdiction-Aware Pricing Display
 *
 * Renders pricing cards for Core, Comprehensive, and Wholesale tiers.
 * Displays amounts in the correct currency based on organisation jurisdiction.
 * Integrates CheckoutButton for each tier.
 */

import { motion } from 'framer-motion'
import { CheckoutButton } from './CheckoutButton'

interface PricingTier {
  name: string
  productType: 'core' | 'comprehensive' | 'wholesale_accountant'
  priceAUD: number
  description: string
  features: string[]
  highlighted?: boolean
}

const TIERS: PricingTier[] = [
  {
    name: 'Core Assessment',
    productType: 'core',
    priceAUD: 495,
    description: 'R&D Tax Incentive + Deduction Optimisation',
    features: [
      'R&D Tax Incentive analysis (Division 355)',
      'Deduction optimisation (22 categories)',
      'AI-powered transaction classification',
      'PDF + Excel report generation',
      'Legislative citations included',
    ],
  },
  {
    name: 'Comprehensive Audit',
    productType: 'comprehensive',
    priceAUD: 995,
    description: 'Full forensic analysis across all tax domains',
    features: [
      'All Core Assessment features',
      'Capital Gains Tax planning (Division 152)',
      'Division 7A compliance monitoring',
      'Fringe Benefits Tax optimisation',
      'Payroll tax multi-state analysis',
      'Loss carry-forward recovery',
      'Compliance calendar + deadline alerts',
      'Accountant-grade verification report',
    ],
    highlighted: true,
  },
  {
    name: 'Wholesale Accountant',
    productType: 'wholesale_accountant',
    priceAUD: 795,
    description: 'Multi-client access for accounting firms',
    features: [
      'All Comprehensive Audit features',
      'Bulk client management dashboard',
      'White-label report generation',
      'Wholesale pricing (15–35% discount)',
      'Priority email support',
      'API access for integration',
    ],
  },
]

interface PricingTableProps {
  jurisdiction?: 'AU' | 'NZ' | 'UK'
}

export function PricingTable({ jurisdiction = 'AU' }: PricingTableProps) {
  const getCurrencyDisplay = (amountAUD: number) => {
    switch (jurisdiction) {
      case 'NZ':
        return { symbol: '$', amount: Math.round(amountAUD * 1.08), code: 'NZD' } // Approximate
      case 'UK':
        return { symbol: '£', amount: Math.round(amountAUD * 0.52), code: 'GBP' } // Approximate
      default:
        return { symbol: '$', amount: amountAUD, code: 'AUD' }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {TIERS.map((tier, index) => {
        const currency = getCurrencyDisplay(tier.priceAUD)
        return (
          <motion.div
            key={tier.productType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={`
              relative flex flex-col rounded-sm border-[0.5px] p-6
              ${
                tier.highlighted
                  ? 'border-[#00F5FF]/30 bg-[#00F5FF]/5'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }
            `}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-sm bg-[#00F5FF]/20 px-3 py-1 text-xs font-medium text-[#00F5FF]">
                  Most Popular
                </span>
              </div>
            )}

            <h3 className="text-lg font-medium text-white">{tier.name}</h3>
            <p className="mt-1 text-sm text-white/50">{tier.description}</p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">
                {currency.symbol}{currency.amount.toLocaleString()}
              </span>
              <span className="text-sm text-white/40">{currency.code}</span>
            </div>

            <ul className="mt-6 flex-1 space-y-2">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-white/60">
                  <span className="mt-0.5 text-[#00FF88]">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <CheckoutButton
                productType={tier.productType}
                label={tier.highlighted ? 'Get Started' : 'Select Plan'}
                variant={tier.highlighted ? 'primary' : 'secondary'}
              />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
