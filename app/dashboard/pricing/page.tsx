/**
 * Pricing & Audit Licenses - v8.1 Scientific Luxury Tier
 * 
 * Commercial model for direct business owners and accounting partnerships.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    ShieldCheck,
    Users,
    Building2,
    CheckCircle2,
    Zap,
    ArrowRight,
    ShieldAlert,
    Terminal,
    Loader2
} from 'lucide-react'
import { TaxDisclaimer } from '@/components/dashboard/TaxDisclaimer'

interface PricingCardProps {
    title: string
    price: string
    description: string
    features: string[]
    buttonText: string
    highlight?: boolean
    badge?: string
    buttonLink?: string
    productType?: 'comprehensive' | 'core'
    onCheckout?: () => Promise<void>
    isLoading?: boolean
}

const PricingCard = ({
    title,
    price,
    description,
    features,
    buttonText,
    highlight = false,
    badge = '',
    buttonLink = '',
    productType: _productType,
    onCheckout,
    isLoading = false
}: PricingCardProps) => {
    const ButtonContent = () => (
        <>
            {isLoading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                </>
            ) : (
                <>
                    {buttonText} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
            )}
        </>
    );

    const buttonClasses = `w-full py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all ${
        highlight ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-white/10 text-white hover:bg-white/20'
    } ${isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card p-8 flex flex-col items-start relative overflow-hidden group ${
                highlight ? 'border-sky-500/50 bg-sky-500/5 shadow-[0_0_50px_-12px_rgba(14,165,233,0.3)]' : 'border-white/10'
            }`}
        >
            {badge && (
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-sky-500 text-[10px] font-black uppercase tracking-widest text-white">
                    {badge}
                </div>
            )}

            <div className={`w-12 h-12 rounded-xl mb-6 flex items-center justify-center ${
                highlight ? 'bg-sky-500 text-white' : 'bg-white/5 text-sky-400'
            }`}>
                {title === 'Business Owner' ? <Building2 className="w-6 h-6" /> : <Users className="w-6 h-6" />}
            </div>

            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-sky-400 mb-2">{title}</h3>
            <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-white tracking-tighter">${price}</span>
                <span className="text-white/40 text-xs font-bold font-mono">/AUD</span>
            </div>

            <p className="text-sm text-white/60 mb-8 leading-relaxed">
                {description}
            </p>

            <div className="space-y-4 mb-10 w-full">
                {features.map((feature: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-white/70 font-medium leading-tight">{feature}</span>
                    </div>
                ))}
            </div>

            {buttonLink ? (
                <Link href={buttonLink} className={buttonClasses}>
                    <ButtonContent />
                </Link>
            ) : (
                <button
                    className={buttonClasses}
                    onClick={onCheckout}
                    disabled={isLoading}
                >
                    <ButtonContent />
                </button>
            )}
        </motion.div>
    );
}

export default function PricingPage() {
    const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleCheckout = async (productType: 'comprehensive' | 'core') => {
        try {
            setLoadingCheckout(productType)
            setError(null)

            const response = await fetch('/api/checkout/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productType }),
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
            setLoadingCheckout(null)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 py-6 sm:py-12">
                {/* Header Block */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="flex justify-center items-center gap-2 text-xs font-bold font-mono text-sky-400 uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Forensic License Matrix</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter">Choose Your Audit Power.</h1>
                    <p className="text-lg text-white/50 leading-relaxed font-medium mt-4">
                        Professional-grade forensic auditing for the free market. <br />
                        Select the license that fits your financial scale.
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    <PricingCard
                        title="Business Owner"
                        price="995"
                        description="Complete self-service forensic analysis for a single organization. Discover every hidden benefit instantly."
                        buttonText="Unlock Business License"
                        productType="comprehensive"
                        onCheckout={() => handleCheckout('comprehensive')}
                        isLoading={loadingCheckout === 'comprehensive'}
                        features={[
                            '1 Organization Included',
                            '5-Year Historical Ledger Sync',
                            'AI-Driven R&D Discovery ($20k+ Potential)',
                            'Deduction Leakage Analysis',
                            'Division 7A Risk Monitoring',
                            'Full "Audit Outline" PDF Export',
                            'Additional Organizations: $199 each'
                        ]}
                    />

                    <PricingCard
                        title="Accountant / CA"
                        price="495"
                        highlight={true}
                        badge="Partner Program"
                        description="Wholesale credits for professional entities. Provide elite tax health checks as a value-add for your clients."
                        buttonText="Apply for Accountant Pricing"
                        buttonLink="/accountant/apply"
                        features={[
                            '1 Organization Included',
                            'Wholesale License Pricing (-50%)',
                            'Professional Audit Package Export',
                            'White-labeled CSV Data Sheets',
                            'Accountant-Layer Evidence Analysis',
                            'Batch Multi-Client Dashboard',
                            'Additional Organizations: $199 each'
                        ]}
                    />
                </div>

                {/* Disclaimers & Integrity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-8 sm:pt-12 border-t border-white/10">
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-red-400 font-black uppercase text-[10px] tracking-widest">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Assistance Only</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                            This system is an auditing tool designed to assist in finding missed items. It is not a DIY Tax Machine and does not replace professional advice.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-sky-400 font-black uppercase text-[10px] tracking-widest">
                            <Terminal className="w-3 h-3" />
                            <span>Forensic Traceability</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                            Every data point is mapped to ITAA 1997/1936 legislation with live links to ATO rulings for absolute defensibility in a professional review.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-[10px] tracking-widest">
                            <Zap className="w-3 h-3" />
                            <span>Revenue Unlock</span>
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                            Accountants can on-charge this service as a "Tax Health Check," turning a $495 cost into a high-margin advisory engagement.
                        </p>
                    </div>
                </div>

                <TaxDisclaimer />
            </div>
        </div>
    )
}
