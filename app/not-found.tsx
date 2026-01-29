'use client'

/**
 * 404 Not Found Page
 *
 * Displayed when a user navigates to a page that doesn't exist.
 */

import Link from 'next/link'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-8 max-w-2xl w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-8 h-8 text-amber-400" />
        </div>

        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">
          Page Not Found
        </h2>

        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or may have been moved.
          Try navigating back to the dashboard.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/dashboard" className="btn btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
          <p className="text-sm text-[var(--text-muted)]">
            Common pages:
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <Link
              href="/dashboard"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              Dashboard
            </Link>
            <span className="text-[var(--text-muted)]">•</span>
            <Link
              href="/dashboard/forensic-audit"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              Forensic Audit
            </Link>
            <span className="text-[var(--text-muted)]">•</span>
            <Link
              href="/dashboard/tax-reporting"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              Tax Reporting
            </Link>
            <span className="text-[var(--text-muted)]">•</span>
            <Link
              href="/dashboard/rnd"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              R&D Assessment
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
