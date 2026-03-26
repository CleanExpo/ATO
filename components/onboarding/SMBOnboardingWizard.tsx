'use client'

/**
 * SMB Onboarding Wizard
 *
 * 4-step guided onboarding for new SMB clients:
 *   Step 1 — Business details (name, registration number, entity type)
 *   Step 2 — Jurisdiction selection (AU / NZ / UK)
 *   Step 3 — Accounting software connection (Xero / MYOB / QuickBooks)
 *   Step 4 — Plan selection + Stripe checkout
 *
 * Design system: Scientific Luxury (OLED black, spectral accents, rounded-sm, Framer Motion).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CheckoutButton } from '@/components/checkout/CheckoutButton'
import type { Jurisdiction } from '@/lib/types/jurisdiction'
import { JURISDICTION_CONFIGS } from '@/lib/types/jurisdiction'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type EntityType =
  | 'company'
  | 'partnership'
  | 'trust'
  | 'sole_trader'
  | 'smsf'
  | 'non_profit'

interface WizardState {
  // Step 1
  businessName: string
  registrationNumber: string // ABN (AU) / NZBN (NZ) / CRN (UK)
  entityType: EntityType | ''
  // Step 2
  jurisdiction: Jurisdiction | ''
  // Step 3 — connection is handled via OAuth redirects
  accountingSoftware: 'xero' | 'myob' | 'quickbooks' | 'none' | ''
  // Step 4
  selectedPlan: 'core' | 'comprehensive' | ''
}

const INITIAL_STATE: WizardState = {
  businessName: '',
  registrationNumber: '',
  entityType: '',
  jurisdiction: '',
  accountingSoftware: '',
  selectedPlan: '',
}

// ─────────────────────────────────────────────
// Step config
// ─────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Business Details' },
  { id: 2, label: 'Jurisdiction' },
  { id: 3, label: 'Accounting Software' },
  { id: 4, label: 'Choose Plan' },
]

// ─────────────────────────────────────────────
// Entity type options per jurisdiction
// ─────────────────────────────────────────────

const ENTITY_OPTIONS: Record<Jurisdiction, { value: EntityType; label: string }[]> = {
  AU: [
    { value: 'company', label: 'Company (Pty Ltd)' },
    { value: 'trust', label: 'Trust' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole_trader', label: 'Sole Trader' },
    { value: 'smsf', label: 'Self-Managed Super Fund' },
    { value: 'non_profit', label: 'Not-for-Profit' },
  ],
  NZ: [
    { value: 'company', label: 'Company (Limited)' },
    { value: 'trust', label: 'Trust' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole_trader', label: 'Sole Trader' },
    { value: 'non_profit', label: 'Charitable Trust / Society' },
  ],
  UK: [
    { value: 'company', label: 'Limited Company (Ltd)' },
    { value: 'partnership', label: 'LLP / Partnership' },
    { value: 'sole_trader', label: 'Sole Trader' },
    { value: 'non_profit', label: 'CIC / Charity' },
  ],
}

const ALL_ENTITY_OPTIONS = ENTITY_OPTIONS.AU // Fallback before jurisdiction chosen

// ─────────────────────────────────────────────
// Registration number label per jurisdiction
// ─────────────────────────────────────────────

function getRegNumLabel(jurisdiction: Jurisdiction | ''): string {
  if (jurisdiction === 'NZ') return 'NZBN (New Zealand Business Number)'
  if (jurisdiction === 'UK') return 'CRN (Companies House Registration)'
  return 'ABN (Australian Business Number)'
}

function getRegNumPlaceholder(jurisdiction: Jurisdiction | ''): string {
  if (jurisdiction === 'NZ') return '9-digit NZBN'
  if (jurisdiction === 'UK') return '8-character CRN'
  return '11-digit ABN'
}

// ─────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {STEPS.map((step, idx) => {
        const done = step.id < current
        const active = step.id === current
        return (
          <div key={step.id} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                  done
                    ? 'border-[#00FF88] bg-[#00FF88]/10 text-[#00FF88]'
                    : active
                    ? 'border-[#00F5FF] bg-[#00F5FF]/10 text-[#00F5FF]'
                    : 'border-white/10 bg-white/5 text-white/30'
                }`}
              >
                {done ? '✓' : step.id}
              </div>
              <span
                className={`hidden text-[10px] tracking-wide sm:block ${
                  active ? 'text-[#00F5FF]' : done ? 'text-[#00FF88]' : 'text-white/30'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 h-[1px] flex-1 transition-colors duration-500 ${
                  done ? 'bg-[#00FF88]/30' : 'bg-white/[0.06]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-white/40">
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#00F5FF]/30 focus:bg-[#00F5FF]/[0.02]"
    />
  )
}

function SelectChip({
  selected,
  onClick,
  children,
  colour = 'cyan',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  colour?: 'cyan' | 'emerald' | 'amber'
}) {
  const colours = {
    cyan: selected
      ? 'border-[#00F5FF]/50 bg-[#00F5FF]/10 text-[#00F5FF]'
      : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/80',
    emerald: selected
      ? 'border-[#00FF88]/50 bg-[#00FF88]/10 text-[#00FF88]'
      : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/80',
    amber: selected
      ? 'border-[#FFB800]/50 bg-[#FFB800]/10 text-[#FFB800]'
      : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/80',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border-[0.5px] px-3 py-2 text-sm transition-colors duration-200 ${colours[colour]}`}
    >
      {children}
    </button>
  )
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  isFirst = false,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  isFirst?: boolean
}) {
  return (
    <div className={`mt-8 flex gap-3 ${isFirst ? 'justify-end' : 'justify-between'}`}>
      {!isFirst && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border-[0.5px] border-white/[0.06] px-5 py-2.5 text-sm text-white/50 hover:border-white/20 hover:text-white/80"
        >
          ← Back
        </button>
      )}
      {onNext && (
        <motion.button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          whileHover={{ scale: nextDisabled ? 1 : 1.02 }}
          whileTap={{ scale: nextDisabled ? 1 : 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`rounded-sm border-[0.5px] px-6 py-2.5 text-sm font-medium transition-colors duration-200 ${
            nextDisabled
              ? 'cursor-not-allowed border-white/[0.04] bg-white/[0.02] text-white/20'
              : 'border-[#00F5FF]/30 bg-[#00F5FF]/10 text-[#00F5FF] hover:bg-[#00F5FF]/20'
          }`}
        >
          {nextLabel} →
        </motion.button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 1 — Business Details
// ─────────────────────────────────────────────

function Step1({
  state,
  update,
  onNext,
}: {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onNext: () => void
}) {
  const entityOptions =
    state.jurisdiction ? ENTITY_OPTIONS[state.jurisdiction as Jurisdiction] : ALL_ENTITY_OPTIONS

  const canProceed = state.businessName.trim().length >= 2 && state.entityType !== ''

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-white">Business Details</h2>
      <p className="mb-6 text-sm text-white/40">Tell us about your business.</p>

      <div className="space-y-5">
        <div>
          <FieldLabel>Business Name</FieldLabel>
          <TextInput
            value={state.businessName}
            onChange={(v) => update({ businessName: v })}
            placeholder="Acme Pty Ltd"
            maxLength={120}
          />
        </div>

        <div>
          <FieldLabel>{getRegNumLabel(state.jurisdiction)}</FieldLabel>
          <TextInput
            value={state.registrationNumber}
            onChange={(v) => update({ registrationNumber: v })}
            placeholder={getRegNumPlaceholder(state.jurisdiction)}
            maxLength={20}
          />
          <p className="mt-1 text-[11px] text-white/25">Optional — used in generated reports</p>
        </div>

        <div>
          <FieldLabel>Entity Type</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {entityOptions.map((opt) => (
              <SelectChip
                key={opt.value}
                selected={state.entityType === opt.value}
                onClick={() => update({ entityType: opt.value })}
              >
                {opt.label}
              </SelectChip>
            ))}
          </div>
        </div>
      </div>

      <NavButtons
        isFirst
        onNext={onNext}
        nextDisabled={!canProceed}
        nextLabel="Continue"
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 2 — Jurisdiction
// ─────────────────────────────────────────────

const JURISDICTION_META: Record<
  Jurisdiction,
  { flag: string; authority: string; currency: string; description: string }
> = {
  AU: {
    flag: '🇦🇺',
    authority: 'ATO',
    currency: 'AUD',
    description: 'Australian Taxation Office — July–June financial year',
  },
  NZ: {
    flag: '🇳🇿',
    authority: 'IRD',
    currency: 'NZD',
    description: 'Inland Revenue Department — April–March financial year',
  },
  UK: {
    flag: '🇬🇧',
    authority: 'HMRC',
    currency: 'GBP',
    description: 'HM Revenue & Customs — April 6–April 5 tax year',
  },
}

function Step2({
  state,
  update,
  onBack,
  onNext,
}: {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-white">Jurisdiction</h2>
      <p className="mb-6 text-sm text-white/40">
        Select the tax jurisdiction for your business.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(JURISDICTION_META) as Jurisdiction[]).map((j) => {
          const meta = JURISDICTION_META[j]
          const config = JURISDICTION_CONFIGS[j]
          const selected = state.jurisdiction === j
          return (
            <button
              key={j}
              type="button"
              onClick={() => update({ jurisdiction: j, entityType: '' })}
              className={`rounded-sm border-[0.5px] p-4 text-left transition-colors duration-200 ${
                selected
                  ? 'border-[#00F5FF]/40 bg-[#00F5FF]/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{meta.flag}</span>
                <span
                  className={`text-sm font-semibold ${selected ? 'text-[#00F5FF]' : 'text-white/80'}`}
                >
                  {config.name}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/35">{meta.description}</p>
              <div className="mt-2 flex gap-2">
                <span className="rounded-sm border-[0.5px] border-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                  {meta.authority}
                </span>
                <span className="rounded-sm border-[0.5px] border-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                  {meta.currency}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={state.jurisdiction === ''}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 3 — Accounting Software
// ─────────────────────────────────────────────

const SOFTWARE_OPTIONS = [
  {
    id: 'xero' as const,
    name: 'Xero',
    logo: '🔵',
    description: 'Connect via OAuth — imports transactions, invoices, BAS/GST data.',
    connectUrl: '/api/auth/xero',
    availableIn: ['AU', 'NZ', 'UK'],
  },
  {
    id: 'myob' as const,
    name: 'MYOB',
    logo: '🟣',
    description: 'Connect via OAuth — Australian & New Zealand businesses.',
    connectUrl: '/api/auth/myob',
    availableIn: ['AU', 'NZ'],
  },
  {
    id: 'quickbooks' as const,
    name: 'QuickBooks Online',
    logo: '🟢',
    description: 'Connect via OAuth — global coverage including AU, NZ, UK.',
    connectUrl: '/api/auth/quickbooks',
    availableIn: ['AU', 'NZ', 'UK'],
  },
  {
    id: 'none' as const,
    name: 'Skip for now',
    logo: '⏭',
    description: 'You can connect accounting software later from the dashboard.',
    connectUrl: null,
    availableIn: ['AU', 'NZ', 'UK'],
  },
]

function Step3({
  state,
  update,
  onBack,
  onNext,
}: {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}) {
  const jurisdiction = state.jurisdiction || 'AU'
  const available = SOFTWARE_OPTIONS.filter((s) =>
    s.availableIn.includes(jurisdiction)
  )

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-white">Accounting Software</h2>
      <p className="mb-6 text-sm text-white/40">
        Connect your accounting platform to import transactions for analysis.
      </p>

      <div className="space-y-2">
        {available.map((sw) => {
          const selected = state.accountingSoftware === sw.id
          return (
            <button
              key={sw.id}
              type="button"
              onClick={() => update({ accountingSoftware: sw.id })}
              className={`w-full rounded-sm border-[0.5px] p-4 text-left transition-colors duration-200 ${
                selected
                  ? 'border-[#00F5FF]/40 bg-[#00F5FF]/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">{sw.logo}</span>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      selected ? 'text-[#00F5FF]' : 'text-white/80'
                    }`}
                  >
                    {sw.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/35">{sw.description}</p>
                </div>
                {selected && (
                  <span className="mt-0.5 text-[#00F5FF]">✓</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {state.accountingSoftware &&
        state.accountingSoftware !== 'none' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 overflow-hidden rounded-sm border-[0.5px] border-[#FFB800]/20 bg-[#FFB800]/5 p-3"
          >
            <p className="text-xs text-[#FFB800]/80">
              OAuth connection will open in a new tab after completing your plan selection.
              You can also connect from your dashboard at any time.
            </p>
          </motion.div>
        )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={state.accountingSoftware === ''}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 4 — Plan Selection
// ─────────────────────────────────────────────

const PLAN_CONFIG = {
  core: {
    name: 'Core',
    price: { AU: 'A$497', NZ: 'NZ$537', UK: '£297' },
    colour: 'cyan' as const,
    features: [
      'Forensic deductions analysis',
      'Small business CGT concessions',
      'Division 7A compliance check',
      'PDF & Excel reports',
      '1 organisation',
    ],
  },
  comprehensive: {
    name: 'Comprehensive',
    price: { AU: 'A$995', NZ: 'NZ$1,079', UK: '£595' },
    colour: 'emerald' as const,
    features: [
      'Everything in Core',
      'R&D Tax Incentive analysis',
      'FBT optimisation',
      'Loss utilisation modelling',
      'Trusts & SMSF engines',
      'Priority support',
      'Unlimited organisations',
    ],
  },
}

function Step4({
  state,
  update,
  onBack,
}: {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
}) {
  const jurisdiction = (state.jurisdiction || 'AU') as Jurisdiction

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-white">Choose Your Plan</h2>
      <p className="mb-6 text-sm text-white/40">
        One-time payment — no subscription, no lock-in.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.entries(PLAN_CONFIG) as [keyof typeof PLAN_CONFIG, typeof PLAN_CONFIG.core][]).map(
          ([key, plan]) => {
            const selected = state.selectedPlan === key
            const isComprehensive = key === 'comprehensive'
            const borderCls = selected
              ? isComprehensive
                ? 'border-[#00FF88]/50'
                : 'border-[#00F5FF]/50'
              : 'border-white/[0.06]'
            const bgCls = selected
              ? isComprehensive
                ? 'bg-[#00FF88]/[0.04]'
                : 'bg-[#00F5FF]/[0.04]'
              : 'bg-white/[0.02]'
            const priceCls = isComprehensive ? 'text-[#00FF88]' : 'text-[#00F5FF]'

            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ selectedPlan: key })}
                className={`rounded-sm border-[0.5px] p-5 text-left transition-colors duration-200 ${borderCls} ${bgCls} hover:border-white/20`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    <p className={`text-2xl font-bold ${priceCls}`}>
                      {plan.price[jurisdiction as keyof typeof plan.price]}
                    </p>
                  </div>
                  {selected && (
                    <span className={priceCls}>✓</span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-white/50">
                      <span className="mt-0.5 text-[#00F5FF]/50">›</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          }
        )}
      </div>

      <div className="mt-6">
        {state.selectedPlan ? (
          <CheckoutButton
            productType={state.selectedPlan as 'core' | 'comprehensive'}
            label={`Purchase ${PLAN_CONFIG[state.selectedPlan].name} — ${PLAN_CONFIG[state.selectedPlan].price[jurisdiction as keyof typeof PLAN_CONFIG.core.price]}`}
          />
        ) : (
          <p className="text-center text-xs text-white/25">Select a plan above to continue</p>
        )}
      </div>

      <div className="mt-4 flex justify-start">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border-[0.5px] border-white/[0.06] px-5 py-2.5 text-sm text-white/50 hover:border-white/20 hover:text-white/80"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Root wizard
// ─────────────────────────────────────────────

export function SMBOnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  const variants = {
    enter: { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold text-white">
            Welcome to{' '}
            <span className="text-[#00F5FF]">ATO Tax Optimizer</span>
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Set up your account in a few quick steps.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-[#0a0a0a] p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {step === 1 && (
                <Step1
                  state={state}
                  update={update}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <Step2
                  state={state}
                  update={update}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              )}
              {step === 3 && (
                <Step3
                  state={state}
                  update={update}
                  onBack={() => setStep(2)}
                  onNext={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <Step4
                  state={state}
                  update={update}
                  onBack={() => setStep(3)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-white/20">
          Advisory only — no ATO, IRD, or HMRC lodgement. GST/VAT exclusive.
        </p>
      </div>
    </div>
  )
}
