/**
 * GET /api/alerts/preferences
 *
 * Fetch alert preferences for the authenticated user
 *
 * Response:
 * {
 *   preferences: TaxAlertPreferences | null
 * }
 *
 * POST /api/alerts/preferences
 *
 * Update alert preferences for the authenticated user
 *
 * Body: Partial<TaxAlertPreferences>
 * {
 *   alerts_enabled?: boolean
 *   email_notifications?: boolean
 *   in_app_notifications?: boolean
 *   rnd_alerts?: boolean
 *   deadline_alerts?: boolean
 *   opportunity_alerts?: boolean
 *   compliance_alerts?: boolean
 *   legislative_alerts?: boolean
 *   advance_notice_days?: number
 *   digest_frequency?: 'realtime' | 'daily' | 'weekly'
 *   notification_email?: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   preferences: TaxAlertPreferences
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createErrorResponse, createValidationError } from '@/lib/api/errors'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch preferences
        const { data: preferences, error } = await supabase
            .from('tax_alert_preferences')
            .select('*')
            .eq('tenant_id', user.id)
            .single()

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is OK (user hasn't set preferences yet)
            console.error('Error fetching alert preferences:', error)
            return createErrorResponse(error, { operation: 'fetchAlertPreferences', userId: user.id })
        }

        return NextResponse.json({
            preferences: preferences || null
        })

    } catch (error) {
        console.error('Error in GET /api/alerts/preferences:', error)
        return createErrorResponse(error, { operation: 'getAlertPreferences' })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse body
        const body = await request.json()

        // Validate digest_frequency if provided
        if (body.digest_frequency) {
            const validFrequencies = ['realtime', 'daily', 'weekly']
            if (!validFrequencies.includes(body.digest_frequency)) {
                return createValidationError(`digest_frequency must be one of: ${validFrequencies.join(', ')}`)
            }
        }

        // Validate advance_notice_days if provided
        if (body.advance_notice_days !== undefined) {
            const days = parseInt(body.advance_notice_days)
            if (isNaN(days) || days < 0 || days > 365) {
                return createValidationError('advance_notice_days must be between 0 and 365')
            }
        }

        // Prepare update data
        const updateData = {
            tenant_id: user.id,
            ...body,
            updated_at: new Date().toISOString()
        }

        // Upsert preferences
        const { data: preferences, error: upsertError } = await supabase
            .from('tax_alert_preferences')
            .upsert(updateData, {
                onConflict: 'tenant_id'
            })
            .select()
            .single()

        if (upsertError) {
            console.error('Error updating alert preferences:', upsertError)
            return createErrorResponse(upsertError, { operation: 'updateAlertPreferences', userId: user.id })
        }

        return NextResponse.json({
            success: true,
            preferences
        })

    } catch (error) {
        console.error('Error in POST /api/alerts/preferences:', error)
        return createErrorResponse(error, { operation: 'updateAlertPreferences' })
    }
}
