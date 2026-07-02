/**
 * GET /api/v1/connections/status
 *
 * Public, secret-free readiness manifest for Unite-Group Mission Control to
 * poll. Reports connection state derived from env-var presence only — never
 * from secret values, and no secret material is ever returned.
 */

import { NextResponse } from 'next/server'
import { buildAtoAppConnectionStatus } from '@/lib/connections/status'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(buildAtoAppConnectionStatus())
}
