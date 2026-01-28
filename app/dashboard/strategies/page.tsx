/**
 * Tax Strategies Page
 *
 * Advanced tax planning and optimization tools
 */

'use client'

import { useState } from 'react'
import { ScenarioModeler } from '@/components/strategies/ScenarioModeler'
import { Calculator, TrendingUp, Scale, Building } from 'lucide-react'

const TENANT_ID = '8a8caf6c-614b-45a5-9e15-46375122407c'
const BASE_YEAR = 'FY2023-24'

type TabType = 'scenarios' | 'division7a' | 'sbe'

export default function StrategiesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('scenarios')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Advanced Tax Strategies</h1>
              <p className="text-gray-400 mt-1">
                Scenario modeling and optimization tools
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'scenarios'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="font-medium">Scenario Modeling</span>
          </button>
          <button
            onClick={() => setActiveTab('division7a')}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'division7a'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Scale className="w-5 h-5" />
            <span className="font-medium">Division 7A</span>
          </button>
          <button
            onClick={() => setActiveTab('sbe')}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'sbe'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Building className="w-5 h-5" />
            <span className="font-medium">SBE Checker</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'scenarios' && (
            <ScenarioModeler tenantId={TENANT_ID} baseYear={BASE_YEAR} />
          )}
          {activeTab === 'division7a' && <Division7ACalculator />}
          {activeTab === 'sbe' && <SBEChecker />}
        </div>
      </div>
    </div>
  )
}

/**
 * Division 7A Calculator (Placeholder)
 */
function Division7ACalculator() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
      <Scale className="w-12 h-12 text-purple-400 mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">Division 7A Loan Calculator</h3>
      <p className="text-gray-400 mb-4">
        Calculate minimum yearly repayments for shareholder loans
      </p>
      <p className="text-sm text-gray-500">
        Coming soon: Full Division 7A compliance calculator
      </p>
    </div>
  )
}

/**
 * SBE Checker (Placeholder)
 */
function SBEChecker() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
      <Building className="w-12 h-12 text-purple-400 mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">
        Small Business Entity Checker
      </h3>
      <p className="text-gray-400 mb-4">
        Check eligibility for small business tax concessions
      </p>
      <p className="text-sm text-gray-500">
        Coming soon: Full SBE eligibility checker with concession value estimator
      </p>
    </div>
  )
}
