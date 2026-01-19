import Link from "next/link"
import {
  DollarSign,
  BarChart3,
  Beaker,
  FileCheck,
  TrendingDown,
  Shield,
  ArrowRight,
  CheckCircle
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">ATO Tax Optimizer</h1>
              <p className="text-xs text-[var(--text-muted)]">Australian Tax Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="btn btn-ghost text-sm">
              View Dashboard
            </Link>
            <Link href="/api/auth/xero" className="btn btn-xero text-sm">
              Connect Xero
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
              <Beaker className="w-4 h-4" />
              R&D Tax Incentive Specialist
            </div>
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-sky-200 to-emerald-200 bg-clip-text text-transparent leading-tight">
              Unlock Every Dollar of <br />Australian Tax Benefits
            </h2>
            <p className="text-xl text-[var(--text-secondary)] mb-8">
              Deep AI analysis of your Xero data to identify R&D refunds,
              unclaimed deductions, and tax optimization opportunities.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/api/auth/xero" className="btn btn-xero text-base px-8 py-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
                Connect Xero Account
              </Link>
              <Link href="/dashboard" className="btn btn-secondary text-base px-8 py-4">
                View Demo
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="stat-card accent">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Beaker className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">R&D Tax Incentive</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-4">
                43.5% refundable offset on eligible R&D expenditure under Division 355.
              </p>
              <div className="text-2xl font-bold text-emerald-400">
                Up to $43,500
              </div>
              <div className="text-xs text-[var(--text-muted)]">per $100,000 R&D spend</div>
            </div>

            <div className="stat-card">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center mb-4">
                <TrendingDown className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Loss Recovery</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-4">
                Carry-forward losses and Division 7A compliance for shareholder loans.
              </p>
              <div className="text-2xl font-bold text-sky-400">
                25% Tax Value
              </div>
              <div className="text-xs text-[var(--text-muted)]">on accumulated losses</div>
            </div>

            <div className="stat-card warning">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Deduction Audit</h3>
              <p className="text-[var(--text-secondary)] text-sm mb-4">
                Identify misclassified expenses and unclaimed deductions.
              </p>
              <div className="text-2xl font-bold text-amber-400">
                $20,000
              </div>
              <div className="text-xs text-[var(--text-muted)]">instant asset write-off threshold</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Connect Xero", desc: "Secure OAuth connection to your accounting data" },
              { step: "2", title: "AI Analysis", desc: "Deep scan for R&D, deductions, and misclassifications" },
              { step: "3", title: "Review Findings", desc: "Prioritized recommendations with legislation references" },
              { step: "4", title: "Maximize Refunds", desc: "Claim R&D offsets and optimize tax position" }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="font-semibold mb-2">{item.title}</h4>
                <p className="text-sm text-[var(--text-secondary)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-8">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-8 h-8 text-sky-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-4">Read-Only Analysis</h3>
                <p className="text-[var(--text-secondary)] mb-6">
                  Your data is never modified. We only analyze and recommend – all changes
                  require your review and should be implemented with professional advice.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "No modifications to Xero data",
                    "Full ATO legislation citations",
                    "Professional review recommended",
                    "HTTPS encrypted connections"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-sky-600/20 to-emerald-600/20">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Optimize Your Tax Position?</h3>
          <p className="text-[var(--text-secondary)] mb-8">
            Connect your Xero account and discover potential R&D refunds,
            unclaimed deductions, and tax optimization opportunities.
          </p>
          <Link href="/api/auth/xero" className="btn btn-xero text-lg px-10 py-4">
            Get Started with Xero
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[var(--border-default)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-[var(--text-muted)]">
          <div>© 2026 ATO Tax Optimizer. Analysis recommendations only.</div>
          <div className="flex items-center gap-6">
            <span>Division 355 ITAA 1997</span>
            <span>Xero Integration</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
