'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    DollarSign,
    LayoutDashboard,
    Beaker,
    FileSearch,
    TrendingDown,
    Settings,
    User,
    Building2,
    Mail,
    Save,
    AlertCircle,
    LogOut,
    CheckCircle,
    Loader2
} from 'lucide-react'

interface XeroConnection {
    tenant_id: string
    tenant_name: string
    organisation_name: string
    country_code: string
    connected_at: string
}

export default function SettingsPage() {
    const [accountantName, setAccountantName] = useState('')
    const [accountantEmail, setAccountantEmail] = useState('')
    const [accountantFirm, setAccountantFirm] = useState('')
    const [businessName, setBusinessName] = useState('')
    const [businessABN, setBusinessABN] = useState('')
    const [saved, setSaved] = useState(false)

    // Xero connection state
    const [xeroConnections, setXeroConnections] = useState<XeroConnection[]>([])
    const [xeroLoading, setXeroLoading] = useState(true)
    const [xeroError, setXeroError] = useState<string | null>(null)

    // Fetch Xero connection status on mount
    useEffect(() => {
        async function fetchXeroConnections() {
            try {
                const res = await fetch('/api/xero/organizations')
                if (!res.ok) {
                    throw new Error(`Failed to fetch connections: ${res.status}`)
                }

                const data = await res.json()
                setXeroConnections(data.organisations || [])
            } catch (err) {
                console.error('Error fetching Xero connections:', err)
                setXeroError(err instanceof Error ? err.message : 'Failed to load Xero connections')
            } finally {
                setXeroLoading(false)
            }
        }

        fetchXeroConnections()
    }, [])

    const handleSave = () => {
        // In a real implementation, this would save to database
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold">ATO Optimizer</h1>
                            <p className="text-xs text-[var(--text-muted)]">Tax Intelligence</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <Link href="/dashboard" className="sidebar-link">
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                        </Link>
                        <Link href="/dashboard/rnd" className="sidebar-link">
                            <Beaker className="w-5 h-5" />
                            <span>R&D Assessment</span>
                        </Link>
                        <Link href="/dashboard/audit" className="sidebar-link">
                            <FileSearch className="w-5 h-5" />
                            <span>Tax Audit</span>
                        </Link>
                        <Link href="/dashboard/losses" className="sidebar-link">
                            <TrendingDown className="w-5 h-5" />
                            <span>Loss Analysis</span>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-[var(--border-default)]">
                    <Link href="/dashboard/settings" className="sidebar-link active">
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-[280px] flex-1 p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Settings</h2>
                        <p className="text-[var(--text-secondary)]">
                            Configure your business and accountant details
                        </p>
                    </div>
                    <Link href="/auth/logout" className="btn btn-secondary">
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </Link>
                </div>

                {saved && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                        <Save className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400">Settings saved successfully!</span>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Business Details */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-sky-400" />
                            </div>
                            <h3 className="font-semibold">Business Details</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    Business Name
                                </label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Your Business Pty Ltd"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] focus:border-sky-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    ABN
                                </label>
                                <input
                                    type="text"
                                    value={businessABN}
                                    onChange={(e) => setBusinessABN(e.target.value)}
                                    placeholder="XX XXX XXX XXX"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] focus:border-sky-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Accountant Details */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="font-semibold">Accountant Details</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    Accountant Name
                                </label>
                                <input
                                    type="text"
                                    value={accountantName}
                                    onChange={(e) => setAccountantName(e.target.value)}
                                    placeholder="John Smith"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={accountantEmail}
                                    onChange={(e) => setAccountantEmail(e.target.value)}
                                    placeholder="accountant@firm.com.au"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    Firm Name
                                </label>
                                <input
                                    type="text"
                                    value={accountantFirm}
                                    onChange={(e) => setAccountantFirm(e.target.value)}
                                    placeholder="Accounting Firm Pty Ltd"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Xero Connection */}
                <div className="glass-card p-6 mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#13B5EA]/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-[#13B5EA]" />
                        </div>
                        <h3 className="font-semibold">Xero Connection</h3>
                    </div>

                    {xeroLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-[#13B5EA]" />
                            <span className="ml-3 text-[var(--text-secondary)]">
                                Loading connection status...
                            </span>
                        </div>
                    )}

                    {xeroError && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-400">Error loading connections</p>
                                    <p className="text-xs text-red-400/70 mt-1">{xeroError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!xeroLoading && !xeroError && xeroConnections.length === 0 && (
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-tertiary)]">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400" />
                                <span className="text-[var(--text-secondary)]">
                                    No Xero account connected
                                </span>
                            </div>
                            <Link href="/api/auth/xero" className="btn btn-xero">
                                Connect Xero
                            </Link>
                        </div>
                    )}

                    {!xeroLoading && !xeroError && xeroConnections.length > 0 && (
                        <div className="space-y-4">
                            {xeroConnections.map((conn) => (
                                <div key={conn.tenant_id} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                                <span className="font-semibold text-emerald-400">
                                                    Connected to Xero
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-muted)]">Organization:</span>
                                                    <span className="text-[var(--text-primary)] font-medium">
                                                        {conn.organisation_name}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-muted)]">Country:</span>
                                                    <span className="text-[var(--text-secondary)]">
                                                        {conn.country_code}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-muted)]">Connected:</span>
                                                    <span className="text-[var(--text-secondary)]">
                                                        {new Date(conn.connected_at).toLocaleString()}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-muted)]">Tenant ID:</span>
                                                    <span className="text-xs text-[var(--text-muted)] font-mono">
                                                        {conn.tenant_id}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (confirm(`Disconnect from ${conn.organisation_name}?`)) {
                                                    // TODO: Implement disconnect API
                                                    alert('Disconnect functionality coming soon')
                                                }
                                            }}
                                            className="btn btn-secondary text-sm"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <Link href="/api/auth/xero" className="btn btn-secondary w-full">
                                Connect Another Organization
                            </Link>
                        </div>
                    )}
                </div>

                {/* Email Settings */}
                <div className="glass-card p-6 mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="font-semibold">Email Settings</h3>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Configure email sending for the <code className="text-sky-400">/send-to-accountant</code> workflow
                    </p>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-sm text-amber-400">
                            Email settings are configured via environment variables for security.
                            Contact your administrator to update Gmail App Password settings.
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 flex justify-end">
                    <button onClick={handleSave} className="btn btn-primary px-8">
                        <Save className="w-4 h-4" />
                        Save Settings
                    </button>
                </div>
            </main>
        </div>
    )
}
