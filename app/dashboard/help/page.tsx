/**
 * Help & Documentation Center - v8.1 Scientific Luxury Tier
 * 
 * Centralized knowledge base for the ATO Optimization Suite.
 * Contextual legislation, guides, and technical support.
 */

'use client'

import React from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen,
    HelpCircle,
    MessageSquare,
    Search,
    ExternalLink,
    Terminal,
    Calculator,
    Shield,
    Play
} from 'lucide-react';

const HelpPage = () => {
    const categories = [
        {
            title: 'Forensic Audit',
            icon: <Terminal className="w-5 h-5 text-sky-400" />,
            description: 'Understanding the AI analysis process and confidence scoring.',
            links: [
                { label: 'Syncing Data (Xero/MYOB)', href: '#' },
                { label: 'AI Analysis Logic', href: '#' },
                { label: 'Confidence Score System', href: '#' }
            ]
        },
        {
            title: 'Tax Optimization',
            icon: <Calculator className="w-5 h-5 text-emerald-400" />,
            description: 'Legislative guides for R&D, Division 7A, and SBE.',
            links: [
                { label: 'Division 355 (R&D)', href: '#' },
                { label: 'Division 7A Risks', href: '#' },
                { label: 'SBE Concessions', href: '#' }
            ]
        },
        {
            title: 'Compliance',
            icon: <Shield className="w-5 h-5 text-amber-400" />,
            description: 'Ensuring your tax position is legally defensible.',
            links: [
                { label: 'Audit Trail Export', href: '#' },
                { label: 'Legislation Mapping', href: '#' },
                { label: 'Amendment Windows', href: '#' }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-dashboard)] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">

                {/* Header Section */}
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full"
                    >
                        <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Knowledge Base</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl font-black text-white tracking-tighter"
                    >
                        How can we assist you?
                    </motion.h1>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-2xl mx-auto mt-8 relative"
                    >
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                        <input
                            type="text"
                            placeholder="Search legislation, guides, or system features..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-12 pr-6 text-white text-lg focus:outline-none focus:border-sky-500/50 transition-all placeholder:text-white/20"
                        />
                    </motion.div>
                </div>

                {/* Quick Links / Video */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                    <div className="glass-card p-10 border-white/10 overflow-hidden relative group">
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center mb-6 shadow-lg shadow-sky-500/20">
                                <Play className="w-6 h-6 text-[#050505] fill-current ml-1" />
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tight mb-3">Quick Start Guide</h2>
                            <p className="text-white/40 text-sm leading-relaxed mb-6">Learn how to connect your first tenant and run a 5-year forensic audit in under 10 minutes.</p>
                            <button className="text-[10px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-2 group-hover:gap-4 transition-all">
                                Watch Tutorial <ExternalLink className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full" />
                    </div>

                    <div className="glass-card p-10 border-white/10 overflow-hidden relative group">
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                                <BookOpen className="w-6 h-6 text-[#050505]" />
                            </div>
                            <h2 className="text-3xl font-black text-white tracking-tight mb-3">Legislative Library</h2>
                            <p className="text-white/40 text-sm leading-relaxed mb-6">Deep dive into ITAA 1997 and ITAA 1936 references used by our AI analysis engine.</p>
                            <button className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 group-hover:gap-4 transition-all">
                                View Documents <ExternalLink className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
                    </div>
                </motion.div>

                {/* Category Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {categories.map((cat, idx) => (
                        <motion.div
                            key={cat.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + (idx * 0.1) }}
                            className="glass-card p-8 border-white/5 hover:border-white/20 transition-all flex flex-col"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                                {cat.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{cat.title}</h3>
                            <p className="text-xs text-white/40 mb-8 leading-relaxed">{cat.description}</p>
                            <div className="space-y-4 mt-auto">
                                {cat.links.map(link => (
                                    <a key={link.label} href={link.href} className="flex items-center justify-between group/link">
                                        <span className="text-sm text-white/60 group-hover/link:text-white transition-colors">{link.label}</span>
                                        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover/link:text-sky-400 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Support CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center"
                >
                    <h2 className="text-3xl font-bold text-white mb-4">Still need help?</h2>
                    <p className="text-white/40 max-w-lg mx-auto mb-10">Our elite tax support team is available for technical assistance regarding your data syncs and analysis results.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <button className="px-10 py-5 bg-white text-[#050505] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center gap-3">
                            <MessageSquare className="w-4 h-4" /> Open Support Ticket
                        </button>
                        <button className="px-10 py-5 bg-white/5 border border-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                            Contact Sales
                        </button>
                    </div>
                </motion.div>

                {/* Footer info */}
                <div className="text-center pb-12">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                        System Version: 8.1.0-Release • Build: 2026.01.28.02
                    </p>
                </div>

            </div>
        </div>
    );
};

export default HelpPage;
