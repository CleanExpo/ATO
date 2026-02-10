import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        console.error('[CLIENT ERROR]', JSON.stringify(body, null, 2))
        return NextResponse.json({ logged: true })
    } catch {
        return NextResponse.json({ logged: false }, { status: 400 })
    }
}
