import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, createRateLimitResponse } from '@/lib/middleware/rate-limit'

const MAX_BODY_SIZE = 4096 // 4KB

/**
 * Sanitise control characters from a string to prevent log injection.
 * Preserves newlines and tabs for readability.
 */
function sanitiseControlChars(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

export async function POST(request: NextRequest) {
    // Rate limit: 20 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || request.headers.get('x-real-ip') || 'anonymous'
    const limitResult = rateLimit({
        identifier: `log-error:${ip}`,
        limit: 20,
        windowSeconds: 60,
    })
    if (!limitResult.success) {
        return createRateLimitResponse(limitResult)
    }

    try {
        const rawText = await request.text()

        // Enforce max body size
        if (rawText.length > MAX_BODY_SIZE) {
            return NextResponse.json({ logged: false, error: 'Body exceeds 4KB limit' }, { status: 413 })
        }

        let body: unknown
        try {
            body = JSON.parse(rawText)
        } catch {
            return NextResponse.json({ logged: false, error: 'Invalid JSON' }, { status: 400 })
        }

        // Validate body structure: must be an object with a message field
        if (typeof body !== 'object' || body === null || !('message' in body)) {
            return NextResponse.json({ logged: false, error: 'Body must include a "message" field' }, { status: 400 })
        }

        // Sanitise control characters from the serialised body
        const sanitised = sanitiseControlChars(JSON.stringify(body, null, 2))
        console.error('[CLIENT ERROR]', sanitised)
        return NextResponse.json({ logged: true })
    } catch {
        return NextResponse.json({ logged: false }, { status: 400 })
    }
}
