'use client';

/**
 * Shared Links Management Page
 *
 * Full management interface for share links.
 * Scientific Luxury design system.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer';
import { motion } from 'framer-motion';
import { ShareLinkManager } from '@/components/share';

const SPECTRAL = {
  cyan: '#00F5FF',
  emerald: '#00FF88',
  amber: '#FFB800',
  red: '#FF4444',
  magenta: '#FF00FF',
} as const;

const EASING = {
  outExpo: [0.19, 1, 0.22, 1] as const,
};

export default function SharedLinksPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenantId() {
      try {
        const response = await fetch('/api/xero/organizations');
        const data = await response.json();
        if (data.connections && data.connections.length > 0) {
          setTenantId(data.connections[0].tenant_id);
        } else {
          setError('No Xero organisation connected');
        }
      } catch (_err) {
        setError('Failed to load organisation data');
      } finally {
        setLoading(false);
      }
    }

    fetchTenantId();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 p-4 sm:p-6 lg:p-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASING.outExpo }}
        className="mb-8"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
          <Link href="/dashboard" className="hover:text-white/60 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/dashboard/forensic-audit" className="hover:text-white/60 transition-colors">
            Forensic Audit
          </Link>
          <span>/</span>
          <Link href="/dashboard/forensic-audit/recommendations" className="hover:text-white/60 transition-colors">
            Recommendations
          </Link>
          <span>/</span>
          <span className="text-white/60">Shared Links</span>
        </div>

        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className="h-12 w-12 flex items-center justify-center rounded-full border-[0.5px]"
              style={{
                borderColor: `${SPECTRAL.magenta}40`,
                backgroundColor: `${SPECTRAL.magenta}10`,
                boxShadow: `0 0 30px ${SPECTRAL.magenta}30`,
              }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg className="w-6 h-6" style={{ color: SPECTRAL.magenta }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-light tracking-tight">
                Shared<span className="font-medium text-white"> Links</span>
              </h1>
              <p className="text-sm text-white/40 mt-1">
                Manage secure report sharing with your accountant
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/forensic-audit/recommendations"
            className="flex items-center gap-2 px-4 py-2 rounded-sm text-sm border-[0.5px] transition-all hover:bg-white/5"
            style={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Recommendations
          </Link>
        </div>
      </motion.div>

      {/* ── Content ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: EASING.outExpo }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-white/50">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔗</div>
            <h3 className="text-xl font-medium text-white mb-2">Connection Required</h3>
            <p className="text-white/50 mb-6">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-medium transition-all"
              style={{
                backgroundColor: `${SPECTRAL.cyan}20`,
                borderColor: `${SPECTRAL.cyan}40`,
                color: SPECTRAL.cyan,
              }}
            >
              Connect Xero Organisation
            </Link>
          </div>
        ) : tenantId ? (
          <ShareLinkManager tenantId={tenantId} />
        ) : null}
      </motion.div>

      <TaxDisclaimer />
    </div>
  );
}
