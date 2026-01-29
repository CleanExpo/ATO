/**
 * Jina AI Reader API Client
 *
 * Scrapes web pages and converts them to clean markdown format
 * Perfect for extracting tax information from ATO website
 *
 * API Docs: https://jina.ai/reader
 */

export interface JinaScraperOptions {
  includeLinks?: boolean
  includeImages?: boolean
  timeout?: number
}

export interface JinaScraperResult {
  url: string
  title?: string
  content: string
  markdown: string
  scrapedAt: Date
}

export class JinaScraper {
  private apiKey: string
  private baseUrl = 'https://r.jina.ai'

  constructor(apiKey?: string) {
    // Jina AI token from environment
    this.apiKey = apiKey || process.env.JINA_API_KEY || ''

    if (!this.apiKey) {
      console.warn('⚠️ JINA_API_KEY is not set. Real-time scraping will fail.')
    }
  }

  /**
   * Scrape a URL and return clean markdown content
   *
   * @param url - URL to scrape
   * @param options - Scraping options
   * @returns Scraped content as markdown
   */
  async scrape(
    url: string,
    options: JinaScraperOptions = {}
  ): Promise<JinaScraperResult> {
    try {
      // Jina Reader API: https://r.jina.ai/{url}
      const jinaUrl = `${this.baseUrl}/${url}`

      console.log(`Scraping via Jina AI: ${url}`)

      const response = await fetch(jinaUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/plain',
          'X-Return-Format': 'markdown',
        },
        signal: AbortSignal.timeout(options.timeout || 30000),
      })

      if (!response.ok) {
        throw new Error(`Jina AI API error: ${response.status} ${response.statusText}`)
      }

      const markdown = await response.text()

      // Extract title from markdown (usually first heading)
      const titleMatch = markdown.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : url

      return {
        url,
        title,
        content: markdown,
        markdown,
        scrapedAt: new Date(),
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to scrape ${url}:`, message)
      throw new Error(`Scraping failed: ${message}`)
    }
  }

  /**
   * Scrape and parse instant asset write-off threshold from ATO page
   *
   * @param url - ATO page URL
   * @returns Threshold amount or null
   */
  async parseInstantWriteOffThreshold(url: string): Promise<number | null> {
    try {
      const result = await this.scrape(url)

      // Look for dollar amounts in the content
      // Common patterns: "$20,000", "$150,000", etc.
      const amounts = result.markdown.match(/\$(\d{1,3}(?:,\d{3})*)/g)

      if (!amounts || amounts.length === 0) {
        console.warn('No dollar amounts found in instant write-off page')
        return null
      }

      // Parse all amounts and find the most likely threshold
      const parsedAmounts = amounts
        .map(amount => parseInt(amount.replace(/[$,]/g, '')))
        .filter(n => n >= 1000 && n <= 1000000) // Reasonable threshold range

      if (parsedAmounts.length === 0) {
        return null
      }

      // Return the most commonly mentioned amount
      // Or the largest if they're all different
      const threshold = Math.max(...parsedAmounts)

      console.log(`Parsed instant write-off threshold: $${threshold.toLocaleString()}`)
      return threshold
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to parse instant write-off threshold:', message)
      return null
    }
  }

  /**
   * Scrape and parse R&D tax offset rate from ATO page
   *
   * @param url - ATO page URL
   * @returns Offset rate as decimal (e.g., 0.435 for 43.5%) or null
   */
  async parseRnDOffsetRate(url: string): Promise<number | null> {
    try {
      const result = await this.scrape(url)

      // Look for percentage patterns: "43.5%", "18.5%", etc.
      const percentages = result.markdown.match(/(\d+\.?\d*)%/g)

      if (!percentages || percentages.length === 0) {
        console.warn('No percentages found in R&D page')
        return null
      }

      // Find R&D-specific percentages (typically 18.5% or 43.5%)
      const rndRates = percentages
        .map(p => parseFloat(p.replace('%', '')))
        .filter(n => n >= 10 && n <= 50) // Reasonable R&D offset range

      if (rndRates.length === 0) {
        return null
      }

      // R&D offset is typically the higher rate mentioned
      const rate = Math.max(...rndRates) / 100

      console.log(`Parsed R&D offset rate: ${(rate * 100).toFixed(1)}%`)
      return rate
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to parse R&D offset rate:', message)
      return null
    }
  }

  /**
   * Scrape and parse home office rate from ATO page
   *
   * @param url - ATO page URL
   * @returns Rate per hour as decimal (e.g., 0.67 for 67c) or null
   */
  async parseHomeOfficeRate(url: string): Promise<number | null> {
    try {
      const result = await this.scrape(url)

      // Look for cents per hour: "67 cents", "67c", "$0.67"
      const centsMatch = result.markdown.match(/(\d+)\s*cents?\s+per\s+hour/i) ||
        result.markdown.match(/(\d+)c\s+per\s+hour/i) ||
        result.markdown.match(/\$0\.(\d+)\s+per\s+hour/i)

      if (!centsMatch) {
        console.warn('No home office rate found')
        return null
      }

      const cents = parseInt(centsMatch[1])
      const rate = cents / 100

      console.log(`Parsed home office rate: ${cents}c per hour`)
      return rate
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to parse home office rate:', message)
      return null
    }
  }

  /**
   * Scrape and parse Division 7A benchmark interest rate
   *
   * @param url - ATO page URL
   * @returns Interest rate as decimal (e.g., 0.0825 for 8.25%) or null
   */
  async parseDivision7ARate(url: string): Promise<number | null> {
    try {
      const result = await this.scrape(url)

      // Look for interest rate percentages: "8.25%", "7.5%", etc.
      const percentages = result.markdown.match(/(\d+\.?\d*)%/g)

      if (!percentages || percentages.length === 0) {
        console.warn('No percentages found in Division 7A page')
        return null
      }

      // Division 7A rates are typically 4-10%
      const div7aRates = percentages
        .map(p => parseFloat(p.replace('%', '')))
        .filter(n => n >= 4 && n <= 10)

      if (div7aRates.length === 0) {
        return null
      }

      // Use the most recent rate (typically mentioned first)
      const rate = div7aRates[0] / 100

      console.log(`Parsed Division 7A rate: ${(rate * 100).toFixed(2)}%`)
      return rate
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to parse Division 7A rate:', message)
      return null
    }
  }

  /**
   * Scrape and parse corporate tax rates
   *
   * @param url - ATO page URL
   * @returns Tax rates object or null
   */
  async parseCorporateTaxRates(url: string): Promise<{
    smallBusiness?: number
    standard?: number
  } | null> {
    try {
      const result = await this.scrape(url)

      // Look for tax rate percentages: "25%", "30%", etc.
      const percentages = result.markdown.match(/(\d+)%/g)

      if (!percentages || percentages.length === 0) {
        console.warn('No percentages found in corporate tax page')
        return null
      }

      // Corporate tax rates are typically 25-30%
      const taxRates = percentages
        .map(p => parseInt(p.replace('%', '')))
        .filter(n => n >= 20 && n <= 35)

      if (taxRates.length === 0) {
        return null
      }

      // Typically: 25% for small business, 30% for standard
      const rates = {
        smallBusiness: Math.min(...taxRates) / 100,
        standard: Math.max(...taxRates) / 100,
      }

      console.log(`Parsed corporate tax rates: ${(rates.smallBusiness * 100)}% / ${(rates.standard * 100)}%`)
      return rates
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to parse corporate tax rates:', message)
      return null
    }
  }
}

// Singleton instance
let jinaScraper: JinaScraper | null = null

/**
 * Get or create Jina scraper instance
 */
export function getJinaScraper(): JinaScraper {
  if (!jinaScraper) {
    jinaScraper = new JinaScraper()
  }
  return jinaScraper
}
