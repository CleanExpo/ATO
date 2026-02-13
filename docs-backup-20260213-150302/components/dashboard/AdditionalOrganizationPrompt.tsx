/**
 * Additional Organization License Prompt
 *
 * Displays when user has connected more organizations than their license allows
 * Provides option to purchase additional organization licenses ($199 each)
 */

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/stripe/client'

interface AdditionalOrganizationPromptProps {
  connectedOrganizations: number
  licensedOrganizations: number
  needsAdditionalLicenses: number
}

export function AdditionalOrganizationPrompt({
  connectedOrganizations,
  licensedOrganizations,
  needsAdditionalLicenses,
}: AdditionalOrganizationPromptProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/checkout/additional-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const data = await response.json()

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout')
      setLoading(false)
    }
  }

  // Calculate total cost
  const totalCost = 19900 * needsAdditionalLicenses // $199 per license

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
        {/* Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShieldAlert className="w-6 h-6" style={{ color: 'rgb(245, 158, 11)' }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-xs)',
          }}>
            Additional Organization Licenses Required
          </h3>

          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-md)',
            lineHeight: 1.6,
          }}>
            You have connected <strong>{connectedOrganizations} organizations</strong>, but your current license covers <strong>{licensedOrganizations} organization{licensedOrganizations === 1 ? '' : 's'}</strong>.
            <br />
            Purchase <strong>{needsAdditionalLicenses} additional license{needsAdditionalLicenses === 1 ? '' : 's'}</strong> to access all connected organizations.
          </p>

          {error && (
            <div style={{
              padding: 'var(--space-sm)',
              marginBottom: 'var(--space-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgb(239, 68, 68)',
            }}>
              {error}
            </div>
          )}

          {/* Pricing Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-lg)',
            marginBottom: 'var(--space-md)',
            padding: 'var(--space-sm)',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Price per license
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPrice(19900)}
              </div>
            </div>

            <div style={{ fontSize: '20px', color: 'var(--text-muted)' }}>×</div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Licenses needed
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {needsAdditionalLicenses}
              </div>
            </div>

            <div style={{ fontSize: '20px', color: 'var(--text-muted)' }}>=</div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Total cost
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'rgb(245, 158, 11)' }}>
                {formatPrice(totalCost)}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              padding: 'var(--space-sm) var(--space-lg)',
              background: loading ? 'rgba(245, 158, 11, 0.5)' : 'rgb(245, 158, 11)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgb(217, 119, 6)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgb(245, 158, 11)'
              }
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Purchase {needsAdditionalLicenses} License{needsAdditionalLicenses === 1 ? '' : 's'} ({formatPrice(totalCost)})
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-sm)',
          }}>
            💳 Secure payment via Stripe • One-time payment, no subscription
          </p>
        </div>
      </div>
    </motion.div>
  )
}
