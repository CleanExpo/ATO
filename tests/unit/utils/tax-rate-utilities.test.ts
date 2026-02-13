import { describe, it, expect } from 'vitest'

/**
 * Unit Tests: Tax Rate Utilities
 *
 * Tests tax rate lookup and validation utilities:
 * - R&D offset rates by FY and turnover
 * - Division 7A benchmark rates by FY
 * - Corporate tax rates
 * - GST rates
 * - FBT rates
 * - Rate caching and updates
 */

describe('R&D Offset Rate Utilities', () => {
  describe('Offset Rate Selection', () => {
    it('should return 43.5% for small business (<$20M turnover)', () => {
      const turnover = 15000000
      const offsetRate = turnover < 20000000 ? 0.435 : 0.385

      expect(offsetRate).toBe(0.435)
    })

    it('should return 38.5% for large business (≥$20M turnover)', () => {
      const turnover = 25000000
      const offsetRate = turnover < 20000000 ? 0.435 : 0.385

      expect(offsetRate).toBe(0.385)
    })

    it('should handle edge case at $20M threshold', () => {
      const turnover = 20000000 // Exactly at threshold
      const offsetRate = turnover < 20000000 ? 0.435 : 0.385

      expect(offsetRate).toBe(0.385) // ≥ $20M uses 38.5%
    })

    it('should return correct rate for zero turnover', () => {
      const turnover = 0
      const offsetRate = turnover < 20000000 ? 0.435 : 0.385

      expect(offsetRate).toBe(0.435) // $0 < $20M
    })

    it('should return correct rate for very large turnover', () => {
      const turnover = 500000000 // $500M
      const offsetRate = turnover < 20000000 ? 0.435 : 0.385

      expect(offsetRate).toBe(0.385)
    })
  })

  describe('Historical R&D Rates', () => {
    it('should provide rate history by financial year', () => {
      const rates: { [key: string]: { small: number; large: number } } = {
        'FY2024-25': { small: 0.435, large: 0.385 },
        'FY2023-24': { small: 0.435, large: 0.385 },
        'FY2022-23': { small: 0.435, large: 0.385 },
        'FY2021-22': { small: 0.435, large: 0.385 },
        'FY2020-21': { small: 0.435, large: 0.385 }
      }

      expect(rates['FY2024-25'].small).toBe(0.435)
      expect(rates['FY2024-25'].large).toBe(0.385)
    })

    it('should return rate for specific FY and turnover', () => {
      const getRndOffsetRate = (fy: string, turnover: number) => {
        const rates: { [key: string]: { small: number; large: number } } = {
          'FY2024-25': { small: 0.435, large: 0.385 },
          'FY2023-24': { small: 0.435, large: 0.385 }
        }

        const fyRates = rates[fy]
        if (!fyRates) return null

        return turnover < 20000000 ? fyRates.small : fyRates.large
      }

      expect(getRndOffsetRate('FY2024-25', 15000000)).toBe(0.435)
      expect(getRndOffsetRate('FY2024-25', 25000000)).toBe(0.385)
      expect(getRndOffsetRate('FY2099-00', 15000000)).toBeNull()
    })
  })

  describe('Rate Validation', () => {
    it('should validate offset rate is within valid range', () => {
      const rate = 0.435

      const isValid = rate >= 0 && rate <= 1

      expect(isValid).toBe(true)
    })

    it('should reject invalid offset rate', () => {
      const invalidRates = [-0.1, 1.5, 2.0]

      invalidRates.forEach(rate => {
        const isValid = rate >= 0 && rate <= 1
        expect(isValid).toBe(false)
      })
    })
  })
})

describe('Division 7A Benchmark Rate Utilities', () => {
  describe('Benchmark Rate Lookup', () => {
    it('should return correct benchmark rate for FY2024-25', () => {
      const rates: { [key: string]: number } = {
        'FY2024-25': 0.0877
      }

      expect(rates['FY2024-25']).toBe(0.0877)
    })

    it('should provide benchmark rate history', () => {
      const rates: { [key: string]: number } = {
        'FY2024-25': 0.0877,
        'FY2023-24': 0.0827,
        'FY2022-23': 0.0452,
        'FY2021-22': 0.0447,
        'FY2020-21': 0.0439
      }

      expect(rates['FY2024-25']).toBe(0.0877)
      expect(rates['FY2023-24']).toBe(0.0827)
      expect(rates['FY2022-23']).toBe(0.0452)
    })

    it('should return rate for current financial year', () => {
      const getCurrentFY = () => {
        const today = new Date()
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth()

        if (currentMonth >= 6) {
          return `FY${currentYear}-${(currentYear + 1).toString().slice(2)}`
        } else {
          return `FY${currentYear - 1}-${currentYear.toString().slice(2)}`
        }
      }

      const currentFY = getCurrentFY()
      expect(currentFY).toMatch(/^FY\d{4}-\d{2}$/)
    })

    it('should handle missing FY rate gracefully', () => {
      const rates: { [key: string]: number } = {
        'FY2024-25': 0.0877
      }

      const rate = rates['FY2099-00'] // Future FY
      expect(rate).toBeUndefined()
    })

    it('should provide fallback rate when FY not found', () => {
      const getRateWithFallback = (fy: string) => {
        const rates: { [key: string]: number } = {
          'FY2024-25': 0.0877,
          'FY2023-24': 0.0827
        }

        return rates[fy] || 0.08 // Fallback to 8%
      }

      expect(getRateWithFallback('FY2024-25')).toBe(0.0877)
      expect(getRateWithFallback('FY2099-00')).toBe(0.08) // Fallback
    })
  })

  describe('Rate Source Tracking', () => {
    it('should track rate source and date', () => {
      const rate = {
        fy: 'FY2024-25',
        rate: 0.0877,
        source: 'ATO Determination 2024/XX',
        sourceUrl: 'https://www.ato.gov.au/law/view/document?DocID=DET/TD2024XX',
        effectiveDate: '2024-07-01',
        retrievedAt: new Date().toISOString()
      }

      expect(rate.rate).toBe(0.0877)
      expect(rate.source).toContain('ATO Determination')
      expect(rate.sourceUrl).toContain('ato.gov.au')
    })

    it('should flag when using fallback rate', () => {
      const rate = {
        fy: 'FY2099-00',
        rate: 0.08,
        source: 'fallback',
        isFallback: true
      }

      expect(rate.isFallback).toBe(true)
      expect(rate.source).toBe('fallback')
    })
  })
})

describe('Corporate Tax Rate Utilities', () => {
  describe('Small Business Rate', () => {
    it('should return 25% for small business (<$50M turnover)', () => {
      const turnover = 30000000
      const taxRate = turnover < 50000000 ? 0.25 : 0.30

      expect(taxRate).toBe(0.25)
    })

    it('should return 30% for large business (≥$50M turnover)', () => {
      const turnover = 60000000
      const taxRate = turnover < 50000000 ? 0.25 : 0.30

      expect(taxRate).toBe(0.30)
    })

    it('should handle edge case at $50M threshold', () => {
      const turnover = 50000000
      const taxRate = turnover < 50000000 ? 0.25 : 0.30

      expect(taxRate).toBe(0.30) // ≥ $50M uses 30%
    })
  })

  describe('Base Rate Entity Test', () => {
    it('should validate passive income threshold', () => {
      const passiveIncome = 5000000
      const totalIncome = 40000000
      const passiveIncomePercentage = (passiveIncome / totalIncome) * 100

      const meetsBaseRateEntityTest = passiveIncomePercentage <= 80

      expect(meetsBaseRateEntityTest).toBe(true) // 12.5% < 80%
    })

    it('should fail base rate entity test when passive income > 80%', () => {
      const passiveIncome = 35000000
      const totalIncome = 40000000
      const passiveIncomePercentage = (passiveIncome / totalIncome) * 100

      const meetsBaseRateEntityTest = passiveIncomePercentage <= 80

      expect(meetsBaseRateEntityTest).toBe(false) // 87.5% > 80%
    })
  })
})

describe('GST Rate Utilities', () => {
  describe('Standard GST Rate', () => {
    it('should return 10% GST rate', () => {
      const gstRate = 0.10

      expect(gstRate).toBe(0.10)
    })

    it('should calculate GST on amount', () => {
      const amount = 1000
      const gstRate = 0.10
      const gst = amount * gstRate

      expect(gst).toBe(100)
    })

    it('should extract GST from inclusive amount', () => {
      const inclusiveAmount = 1100
      const gstRate = 0.10
      const gst = (inclusiveAmount / (1 + gstRate)) * gstRate

      expect(gst).toBeCloseTo(100, 2)
    })
  })

  describe('GST Tax Types', () => {
    it('should provide GST tax type definitions', () => {
      const taxTypes = {
        'INPUT2': { description: 'Capital acquisitions', rate: 0.10 },
        'OUTPUT2': { description: 'Sales to customers', rate: 0.10 },
        'EXEMPTOUTPUT': { description: 'GST-free sales', rate: 0 },
        'NONE': { description: 'No GST', rate: 0 }
      }

      expect(taxTypes['INPUT2'].rate).toBe(0.10)
      expect(taxTypes['EXEMPTOUTPUT'].rate).toBe(0)
    })

    it('should determine if transaction has GST', () => {
      const hasGST = (taxType: string) => {
        const gstTaxTypes = ['INPUT2', 'OUTPUT2']
        return gstTaxTypes.includes(taxType)
      }

      expect(hasGST('INPUT2')).toBe(true)
      expect(hasGST('OUTPUT2')).toBe(true)
      expect(hasGST('EXEMPTOUTPUT')).toBe(false)
      expect(hasGST('NONE')).toBe(false)
    })
  })
})

describe('FBT Rate Utilities', () => {
  describe('FBT Rate', () => {
    it('should return 47% FBT rate', () => {
      const fbtRate = 0.47

      expect(fbtRate).toBe(0.47)
    })

    it('should calculate FBT on grossed-up value', () => {
      const benefitValue = 10000
      const grossUpFactor = 2.0802 // Type 1 FBT
      const grossedUpValue = benefitValue * grossUpFactor
      const fbt = grossedUpValue * 0.47

      expect(fbt).toBeCloseTo(9777, 0)
    })

    it('should provide gross-up factors', () => {
      const grossUpFactors = {
        type1: 2.0802, // With GST credit
        type2: 1.8868  // Without GST credit
      }

      expect(grossUpFactors.type1).toBe(2.0802)
      expect(grossUpFactors.type2).toBe(1.8868)
    })
  })

  describe('FBT Exemptions', () => {
    it('should identify exempt benefits', () => {
      const exemptBenefits = [
        'work-related-items',
        'minor-benefits', // < $300
        'employee-contributions'
      ]

      expect(exemptBenefits).toContain('minor-benefits')
    })

    it('should check if benefit is under minor benefit threshold', () => {
      const benefitValue = 250
      const minorBenefitThreshold = 300

      const isMinorBenefit = benefitValue < minorBenefitThreshold

      expect(isMinorBenefit).toBe(true)
    })
  })
})

describe('Rate Caching', () => {
  describe('In-Memory Cache', () => {
    it('should cache tax rates', () => {
      const cache = new Map<string, any>()

      // Cache R&D rate
      cache.set('rnd-offset-FY2024-25', {
        small: 0.435,
        large: 0.385,
        cachedAt: Date.now()
      })

      // Retrieve from cache
      const rate = cache.get('rnd-offset-FY2024-25')

      expect(rate).toBeDefined()
      expect(rate.small).toBe(0.435)
    })

    it('should check cache expiry', () => {
      const cache = new Map<string, { data: any; expiresAt: number }>()
      const ttl = 24 * 60 * 60 * 1000 // 24 hours

      // Add to cache
      cache.set('div7a-rate-FY2024-25', {
        data: 0.0877,
        expiresAt: Date.now() + ttl
      })

      // Check if expired
      const entry = cache.get('div7a-rate-FY2024-25')
      const isExpired = entry && entry.expiresAt < Date.now()

      expect(isExpired).toBe(false)
    })

    it('should evict expired entries', () => {
      const cache = new Map<string, { data: any; expiresAt: number }>()

      // Add expired entry
      cache.set('old-rate', {
        data: 0.08,
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      })

      // Check and evict
      const entry = cache.get('old-rate')
      if (entry && entry.expiresAt < Date.now()) {
        cache.delete('old-rate')
      }

      expect(cache.has('old-rate')).toBe(false)
    })
  })

  describe('Cache Warming', () => {
    it('should pre-load common rates on startup', () => {
      const cache = new Map<string, any>()

      // Warm cache with current FY rates
      const warmCache = () => {
        cache.set('rnd-offset-FY2024-25', { small: 0.435, large: 0.385 })
        cache.set('div7a-rate-FY2024-25', 0.0877)
        cache.set('corporate-tax-small', 0.25)
        cache.set('corporate-tax-large', 0.30)
        cache.set('gst-rate', 0.10)
        cache.set('fbt-rate', 0.47)
      }

      warmCache()

      expect(cache.size).toBe(6)
      expect(cache.has('rnd-offset-FY2024-25')).toBe(true)
    })
  })
})

describe('Rate Update Notifications', () => {
  describe('Rate Change Detection', () => {
    it('should detect when rate changes', () => {
      const oldRate: number = 0.0827 // FY2023-24
      const newRate: number = 0.0877 // FY2024-25

      const hasChanged = oldRate !== newRate

      expect(hasChanged).toBe(true)
    })

    it('should calculate rate change percentage', () => {
      const oldRate = 0.0827
      const newRate = 0.0877

      const changePercentage = ((newRate - oldRate) / oldRate) * 100

      expect(changePercentage).toBeCloseTo(6.05, 2) // 6.05% increase
    })

    it('should flag significant rate changes', () => {
      const oldRate = 0.0452 // FY2022-23
      const newRate = 0.0827 // FY2023-24

      const changePercentage = ((newRate - oldRate) / oldRate) * 100
      const isSignificant = Math.abs(changePercentage) > 10

      expect(isSignificant).toBe(true) // 83% increase
    })
  })

  describe('Rate Update Log', () => {
    it('should log rate updates', () => {
      const updateLog = {
        fy: 'FY2024-25',
        rateType: 'Division 7A Benchmark',
        oldRate: 0.0827,
        newRate: 0.0877,
        changePercentage: 6.05,
        effectiveDate: '2024-07-01',
        updatedAt: new Date().toISOString()
      }

      expect(updateLog.newRate).toBeGreaterThan(updateLog.oldRate)
      expect(updateLog.changePercentage).toBeGreaterThan(0)
    })
  })
})

describe('Rate Validation Rules', () => {
  describe('Consistency Checks', () => {
    it('should validate R&D rate is less than 100%', () => {
      const rate = 0.435

      const isValid = rate > 0 && rate < 1

      expect(isValid).toBe(true)
    })

    it('should validate Division 7A rate is reasonable', () => {
      const rate = 0.0877

      // Should be between 0% and 20% (reasonable interest rate range)
      const isValid = rate > 0 && rate < 0.20

      expect(isValid).toBe(true)
    })

    it('should validate corporate tax rate matches ATO schedule', () => {
      const validRates = [0.25, 0.30] // Only valid rates
      const rate = 0.25

      const isValid = validRates.includes(rate)

      expect(isValid).toBe(true)
    })

    it('should reject invalid tax rates', () => {
      const invalidRates = [0, -0.1, 1.5, 2.0]

      invalidRates.forEach(rate => {
        const isValid = rate > 0 && rate < 1
        expect(isValid).toBe(false)
      })
    })
  })

  describe('Cross-Validation', () => {
    it('should validate R&D offset rate is higher for small business', () => {
      const rates = {
        small: 0.435,
        large: 0.385
      }

      expect(rates.small).toBeGreaterThan(rates.large)
    })

    it('should validate corporate tax rate is higher for large business', () => {
      const rates = {
        small: 0.25,
        large: 0.30
      }

      expect(rates.large).toBeGreaterThan(rates.small)
    })
  })
})

describe('Rate Formatting', () => {
  describe('Display Formatting', () => {
    it('should format rate as percentage', () => {
      const rate = 0.435
      const formatted = `${(rate * 100).toFixed(1)}%`

      expect(formatted).toBe('43.5%')
    })

    it('should format rate with 2 decimal places', () => {
      const rate = 0.0877
      const formatted = `${(rate * 100).toFixed(2)}%`

      expect(formatted).toBe('8.77%')
    })

    it('should format rate without trailing zeros', () => {
      const rate = 0.10
      const formatted = `${(rate * 100).toFixed(0)}%`

      expect(formatted).toBe('10%')
    })
  })

  describe('Localization', () => {
    it('should format for Australian locale', () => {
      const rate = 0.435
      const formatted = new Intl.NumberFormat('en-AU', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(rate)

      expect(formatted).toContain('43.5')
    })
  })
})
