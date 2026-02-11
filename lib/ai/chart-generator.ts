/**
 * AI Chart Generator
 *
 * Uses Gemini 3 Pro Image Preview to generate accurate, professional charts
 * for forensic tax audit reports.
 *
 * Model: gemini-3-pro-image-preview
 * Capabilities: Image generation with precise data visualization
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { optionalConfig } from '@/lib/config/env'

// Initialize Google AI lazily to avoid errors when API key is missing
let cachedGenAI: GoogleGenerativeAI | null = null
function getGoogleAI(): GoogleGenerativeAI {
  if (!cachedGenAI) {
    const apiKey = optionalConfig.googleAiApiKey
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured')
    }
    cachedGenAI = new GoogleGenerativeAI(apiKey)
  }
  return cachedGenAI
}

export interface ChartData {
    title: string
    type: 'bar' | 'line' | 'pie' | 'donut' | 'stacked-bar' | 'waterfall'
    data: {
        labels: string[]
        datasets: Array<{
            label: string
            data: number[]
            color?: string
        }>
    }
    description?: string
}

export interface ChartGenerationOptions {
    width?: number
    height?: number
    style?: 'professional' | 'modern' | 'corporate'
    colorScheme?: 'blue' | 'green' | 'mixed' | 'tax-report'
    includeGrid?: boolean
    includeValues?: boolean
}

/**
 * Generate a chart image using Gemini 3 Pro Image Preview
 */
export async function generateChart(
    chartData: ChartData,
    options: ChartGenerationOptions = {}
): Promise<{ imageData: string; mimeType: string }> {
    try {
        const {
            width = 800,
            height = 500,
            style = 'professional',
            colorScheme = 'tax-report',
            includeGrid = true,
            includeValues = true,
        } = options

        // Prepare detailed prompt for accurate chart generation
        const prompt = buildChartPrompt(chartData, {
            width,
            height,
            style,
            colorScheme,
            includeGrid,
            includeValues,
        })

        // Use Gemini 3 Pro Image Preview model
        const model = getGoogleAI().getGenerativeModel({
            model: 'gemini-3-pro-image-preview', // Latest image generation model
            generationConfig: {
                temperature: 0.1, // Low temperature for accurate, consistent charts
                maxOutputTokens: 8192,
            },
        })

        const result = await model.generateContent(prompt)
        const response = result.response

        // Extract generated image
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
            (part) => 'inlineData' in part
        )

        if (!imagePart || !('inlineData' in imagePart) || !imagePart.inlineData) {
            throw new Error('No image generated in response')
        }

        return {
            imageData: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/png',
        }
    } catch (error) {
        console.error('Failed to generate chart:', error)
        throw error
    }
}

/**
 * Build a detailed prompt for accurate chart generation
 */
function buildChartPrompt(
    chartData: ChartData,
    options: Required<ChartGenerationOptions>
): string {
    const { width, height, style, colorScheme, includeGrid, includeValues } = options

    let colorPalette: string[]
    switch (colorScheme) {
        case 'tax-report':
            colorPalette = ['#1e40af', '#16a34a', '#ea580c', '#dc2626', '#7c3aed']
            break
        case 'blue':
            colorPalette = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']
            break
        case 'green':
            colorPalette = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']
            break
        case 'mixed':
            colorPalette = ['#1e40af', '#16a34a', '#ea580c', '#eab308', '#8b5cf6']
            break
        default:
            colorPalette = ['#1e40af', '#16a34a', '#ea580c', '#dc2626', '#7c3aed']
    }

    const datasets = chartData.data.datasets
        .map((dataset, idx) => {
            const color = dataset.color || colorPalette[idx % colorPalette.length]
            return `Dataset "${dataset.label}": [${dataset.data.join(', ')}] (Color: ${color})`
        })
        .join('\n')

    return `Generate a high-quality, professional ${chartData.type} chart with the following specifications:

**Chart Type**: ${chartData.type.toUpperCase()}
**Title**: "${chartData.title}"
**Dimensions**: ${width}px × ${height}px
**Style**: ${style} (clean, corporate, suitable for tax reports)

**Data**:
Labels: [${chartData.data.labels.join(', ')}]

${datasets}

**Visual Requirements**:
- Use a white background
- ${includeGrid ? 'Include' : 'Exclude'} grid lines (subtle, light gray if included)
- ${includeValues ? 'Display data values on chart elements' : 'No data values on chart'}
- Clear, legible axis labels
- Professional font (sans-serif, dark gray for readability)
- Legend positioned at ${chartData.type === 'pie' || chartData.type === 'donut' ? 'right side' : 'top'}
- Precise data representation (NO approximations - exact values only)
- Clean, modern design suitable for Big 4 accounting reports

**Accuracy Requirements**:
- All data points must be EXACTLY as specified
- No rounding or approximation of values
- Precise alignment of bars/lines to axis
- Accurate proportions for pie/donut charts
- Clear differentiation between data series

${chartData.description ? `**Context**: ${chartData.description}` : ''}

**Output**: A ${width}x${height}px PNG image of the chart, ready for inclusion in a professional tax report.`
}

/**
 * Generate multiple charts in batch
 */
export async function generateChartBatch(
    charts: ChartData[],
    options: ChartGenerationOptions = {}
): Promise<Array<{ imageData: string; mimeType: string; title: string }>> {
    const results = []

    for (const chartData of charts) {
        try {
            const result = await generateChart(chartData, options)
            results.push({
                ...result,
                title: chartData.title,
            })

            // Small delay to respect rate limits
            await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
            console.error(`Failed to generate chart "${chartData.title}":`, error)
            results.push({
                imageData: '',
                mimeType: '',
                title: chartData.title,
            })
        }
    }

    return results
}

/**
 * Get model information
 */
export function getImageModelInfo() {
    return {
        model: 'gemini-3-pro-image-preview',
        provider: 'Google AI (Gemini 3 Pro Image)',
        description: 'Latest multimodal model with image generation capabilities',
        version: 'Gemini 3 Pro Image Preview (November 2025)',
        capabilities: ['Image Generation', 'Text to Image', 'Precise Data Visualization'],
        maxInputTokens: 65536,
        maxOutputTokens: 32768,
        outputFormats: ['PNG', 'JPEG'],
        rateLimit: '60 requests/minute',
    }
}

/**
 * Estimate cost for chart generation
 */
export function estimateChartGenerationCost(chartCount: number): {
    estimatedCostUSD: number
    perChart: number
} {
    // Estimated cost per image generation (premium model)
    const costPerImage = 0.05 // $0.05 per chart (estimated)

    return {
        estimatedCostUSD: chartCount * costPerImage,
        perChart: costPerImage,
    }
}
