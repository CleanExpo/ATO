/**
 * Scenario Modeler Component
 *
 * What-if analysis tool for tax optimization strategies
 */

'use client'

import { useState } from 'react'
import { Play, Plus, Trash2, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

interface Scenario {
  name: string
  description?: string
  changes: {
    additionalRndClaim?: number
    deferredIncome?: number
    acceleratedDeductions?: number
    assetPurchases?: number
    div7aLoanReduction?: number
    lossUtilization?: number
  }
}

interface ScenarioResult {
  name: string
  description?: string
  taxableIncome: number
  taxPayable: number
  effectiveTaxRate: number
  rndOffset: number
  netTaxPosition: number
  savingsVsBase: number
  changes: {
    incomeAdjustment: number
    deductionAdjustment: number
    rndOffsetAdjustment: number
  }
  warnings: string[]
  recommendations: string[]
}

interface BaseResult {
  taxableIncome: number
  taxPayable: number
  rndOffset: number
  netTaxPosition: number
}

interface ScenarioInsights {
  bestScenario: string
  maxSavings: number
}

interface ScenarioModelerProps {
  tenantId: string
  baseYear: string
}

export function ScenarioModeler({ tenantId, baseYear }: ScenarioModelerProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [results, setResults] = useState<{
    base: BaseResult
    scenarios: ScenarioResult[]
    insights: ScenarioInsights
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addScenario = () => {
    setScenarios([
      ...scenarios,
      {
        name: `Scenario ${scenarios.length + 1}`,
        description: '',
        changes: {},
      },
    ])
  }

  const updateScenario = (index: number, updates: Partial<Scenario>) => {
    const updated = [...scenarios]
    updated[index] = { ...updated[index], ...updates }
    setScenarios(updated)
  }

  const updateScenarioChange = (
    index: number,
    field: keyof Scenario['changes'],
    value: number | undefined
  ) => {
    const updated = [...scenarios]
    updated[index].changes[field] = value
    setScenarios(updated)
  }

  const removeScenario = (index: number) => {
    setScenarios(scenarios.filter((_, i) => i !== index))
  }

  const calculateScenarios = async () => {
    if (scenarios.length === 0) {
      setError('Please add at least one scenario')
      return
    }

    try {
      setIsCalculating(true)
      setError(null)

      const response = await fetch(`/api/strategies/scenario?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          baseYear,
          scenarios,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to calculate scenarios')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scenario Modeler</h2>
          <p className="text-gray-400 mt-1">
            Model different tax strategies for {baseYear}
          </p>
        </div>
        <button
          onClick={addScenario}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Scenario
        </button>
      </div>

      {/* Scenarios */}
      {scenarios.length === 0 ? (
        <div className="p-8 bg-white/5 border border-white/10 rounded-lg text-center">
          <p className="text-gray-400">
            No scenarios yet. Click "Add Scenario" to start modeling.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.map((scenario, index) => (
            <div
              key={index}
              className="bg-white/5 border border-white/10 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={scenario.name}
                    onChange={(e) =>
                      updateScenario(index, { name: e.target.value })
                    }
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                    placeholder="Scenario name"
                  />
                  <input
                    type="text"
                    value={scenario.description || ''}
                    onChange={(e) =>
                      updateScenario(index, { description: e.target.value })
                    }
                    className="text-sm text-gray-400 bg-transparent border-none focus:outline-none focus:ring-0 w-full mt-1"
                    placeholder="Description (optional)"
                  />
                </div>
                <button
                  onClick={() => removeScenario(index)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ScenarioInput
                  label="Additional R&D Claim"
                  value={scenario.changes.additionalRndClaim}
                  onChange={(v) =>
                    updateScenarioChange(index, 'additionalRndClaim', v)
                  }
                  prefix="$"
                  description="Extra R&D expenditure to claim"
                />
                <ScenarioInput
                  label="Deferred Income"
                  value={scenario.changes.deferredIncome}
                  onChange={(v) => updateScenarioChange(index, 'deferredIncome', v)}
                  prefix="$"
                  description="Income to defer to next year"
                />
                <ScenarioInput
                  label="Accelerated Deductions"
                  value={scenario.changes.acceleratedDeductions}
                  onChange={(v) =>
                    updateScenarioChange(index, 'acceleratedDeductions', v)
                  }
                  prefix="$"
                  description="Bring forward deductions"
                />
                <ScenarioInput
                  label="Asset Purchases"
                  value={scenario.changes.assetPurchases}
                  onChange={(v) => updateScenarioChange(index, 'assetPurchases', v)}
                  prefix="$"
                  description="New assets for instant write-off"
                />
                <ScenarioInput
                  label="Div 7A Loan Reduction"
                  value={scenario.changes.div7aLoanReduction}
                  onChange={(v) =>
                    updateScenarioChange(index, 'div7aLoanReduction', v)
                  }
                  prefix="$"
                  description="Reduce shareholder loans"
                />
                <ScenarioInput
                  label="Loss Utilization"
                  value={scenario.changes.lossUtilization}
                  onChange={(v) =>
                    updateScenarioChange(index, 'lossUtilization', v)
                  }
                  prefix="$"
                  description="Use tax losses carried forward"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calculate Button */}
      {scenarios.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={calculateScenarios}
            disabled={isCalculating}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            {isCalculating ? 'Calculating...' : 'Calculate Scenarios'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-xl font-semibold mb-4">Results</h3>

            {/* Base Scenario */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-4">
              <h4 className="text-sm font-medium text-blue-400 mb-3">
                Current Position ({baseYear})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Taxable Income"
                  value={formatCurrency(results.base.taxableIncome)}
                />
                <MetricCard
                  label="Tax Payable"
                  value={formatCurrency(results.base.taxPayable)}
                />
                <MetricCard
                  label="R&D Offset"
                  value={formatCurrency(results.base.rndOffset)}
                  positive
                />
                <MetricCard
                  label="Net Tax Position"
                  value={formatCurrency(results.base.netTaxPosition)}
                />
              </div>
            </div>

            {/* Scenario Results */}
            {results.scenarios.map((result, index) => (
              <ScenarioResultCard
                key={index}
                result={result}
                baseNet={results.base.netTaxPosition}
              />
            ))}

            {/* Insights */}
            {results.insights && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                <h4 className="text-sm font-medium text-green-400 mb-3">
                  Insights
                </h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-400">Best scenario:</span>{' '}
                    <span className="font-medium">{results.insights.bestScenario}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-400">Maximum savings:</span>{' '}
                    <span className="font-medium text-green-400">
                      {formatCurrency(results.insights.maxSavings)}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Scenario Input Field
 */
function ScenarioInput({
  label,
  value,
  onChange,
  prefix,
  description,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  prefix?: string
  description?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value || ''}
          onChange={(e) =>
            onChange(e.target.value ? parseFloat(e.target.value) : undefined)
          }
          className={`w-full ${prefix ? 'pl-8' : 'pl-3'} pr-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder="0"
        />
      </div>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  )
}

/**
 * Metric Card
 */
function MetricCard({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${positive ? 'text-green-400' : ''}`}>
        {value}
      </div>
    </div>
  )
}

/**
 * Scenario Result Card
 */
function ScenarioResultCard({
  result,
  baseNet,
}: {
  result: ScenarioResult
  baseNet: number
}) {
  const savingsPercentage = baseNet > 0 ? (result.savingsVsBase / baseNet) * 100 : 0

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold">{result.name}</h4>
          {result.description && (
            <p className="text-sm text-gray-400 mt-1">{result.description}</p>
          )}
        </div>
        {result.savingsVsBase > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
            <TrendingDown className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              {formatCurrency(result.savingsVsBase)} saved ({savingsPercentage.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Taxable Income"
          value={formatCurrency(result.taxableIncome)}
        />
        <MetricCard label="Tax Payable" value={formatCurrency(result.taxPayable)} />
        <MetricCard
          label="R&D Offset"
          value={formatCurrency(result.rndOffset)}
          positive
        />
        <MetricCard
          label="Net Tax Position"
          value={formatCurrency(result.netTaxPosition)}
        />
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
            <AlertTriangle className="w-4 h-4" />
            Warnings
          </div>
          <ul className="space-y-1">
            {result.warnings.map((warning, i) => (
              <li key={i} className="text-sm text-gray-300 pl-6">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
            <CheckCircle className="w-4 h-4" />
            Recommendations
          </div>
          <ul className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-300 pl-6">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
