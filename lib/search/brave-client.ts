/**
 * Brave Search API Client
 *
 * Wrapper for Brave Search API to find current tax information from ATO.gov.au
 * API Docs: https://api.search.brave.com/app/documentation/web-search/get-started
 */

export interface BraveSearchResult {
  title: string
  url: string
  description: string
  age?: string
  page_age?: string
  language?: string
  family_friendly?: boolean
}

export interface BraveSearchResponse {
  query: string
  results: BraveSearchResult[]
  totalResults?: number
}

export class BraveSearchClient {
  private apiKey: string
  private baseUrl = 'https://api.search.brave.com/res/v1'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BRAVE_API_KEY || ''

    if (!this.apiKey) {
      throw new Error('BRAVE_API_KEY is required. Set it in .env.local')
    }
  }

  /**
   * Search for tax information on ATO website
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  async search(
    query: string,
    options: {
      count?: number
      offset?: number
      freshness?: 'pd' | 'pw' | 'pm' | 'py' // past day/week/month/year
      site?: string // Restrict to specific site
    } = {}
  ): Promise<BraveSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      count: (options.count || 10).toString(),
      offset: (options.offset || 0).toString(),
      text_decorations: 'false',
      search_lang: 'en',
      country: 'AU', // Australian results
      ui_lang: 'en-AU',
    })

    // Restrict to specific site if provided
    if (options.site) {
      params.set('q', `site:${options.site} ${query}`)
    }

    // Add freshness if specified
    if (options.freshness) {
      params.set('freshness', options.freshness)
    }

    try {
      const response = await fetch(`${this.baseUrl}/web/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      })

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Extract web results
      const webResults = data.web?.results || []

      return {
        query,
        results: webResults.map((result: unknown) => {
          const r = result as Record<string, unknown>
          return {
            title: String(r.title || ''),
            url: String(r.url || ''),
            description: String(r.description || ''),
            age: r.age ? String(r.age) : undefined,
            page_age: r.page_age ? String(r.page_age) : undefined,
            language: r.language ? String(r.language) : undefined,
            family_friendly: typeof r.family_friendly === 'boolean' ? r.family_friendly : undefined,
          }
        }),
        totalResults: data.web?.total || 0,
      }
    } catch (error: unknown) {
      console.error('Brave Search error:', error)
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to search: ${message}`)
    }
  }

  /**
   * Search ATO website for specific tax information
   *
   * @param query - What to search for
   * @returns Top result URL from ATO
   */
  async searchATO(query: string): Promise<string | null> {
    try {
      const results = await this.search(query, {
        site: 'ato.gov.au',
        count: 5,
        freshness: 'pm', // Past month - get recent updates
      })

      if (results.results.length === 0) {
        console.warn(`No ATO results found for: ${query}`)
        return null
      }

      // Return the first (most relevant) result
      const topResult = results.results[0]
      console.log(`Found ATO page: ${topResult.title} - ${topResult.url}`)

      return topResult.url
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to search ATO for "${query}":`, message)
      return null
    }
  }

  /**
   * Find current instant asset write-off threshold
   */
  async findInstantWriteOffPage(): Promise<string | null> {
    return this.searchATO('instant asset write-off threshold 2024-25')
  }

  /**
   * Find R&D tax incentive rates
   */
  async findRnDIncentivePage(): Promise<string | null> {
    return this.searchATO('R&D tax incentive rates offset')
  }

  /**
   * Find home office deduction rates
   */
  async findHomeOfficeRatesPage(): Promise<string | null> {
    return this.searchATO('home office deduction rates cents per hour')
  }

  /**
   * Find Division 7A benchmark interest rates
   */
  async findDivision7ARatesPage(): Promise<string | null> {
    return this.searchATO('Division 7A benchmark interest rate')
  }

  /**
   * Find corporate tax rates
   */
  async findCorporateTaxRatesPage(): Promise<string | null> {
    return this.searchATO('company tax rates small business')
  }
}

// Singleton instance
let braveClient: BraveSearchClient | null = null

/**
 * Get or create Brave Search client instance
 */
export function getBraveClient(): BraveSearchClient {
  if (!braveClient) {
    braveClient = new BraveSearchClient()
  }
  return braveClient
}
