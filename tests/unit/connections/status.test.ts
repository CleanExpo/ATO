import { describe, it, expect } from 'vitest'
import { buildAtoAppConnectionStatus } from '@/lib/connections/status'

const EMPTY_ENV = {} as unknown as NodeJS.ProcessEnv

const FULL_ENV = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
  XERO_CLIENT_ID: 'xero-client-id',
  XERO_CLIENT_SECRET: 'xero-client-secret-value',
  MYOB_CLIENT_ID: 'myob-client-id',
  MYOB_CLIENT_SECRET: 'myob-client-secret-value',
  QUICKBOOKS_CLIENT_ID: 'qb-client-id',
  QUICKBOOKS_CLIENT_SECRET: 'qb-client-secret-value',
  GOOGLE_AI_API_KEY: 'google-ai-key-value',
  STRIPE_SECRET_KEY: 'sk_test_value',
  STRIPE_WEBHOOK_SECRET: 'whsec_value',
  SENDGRID_API_KEY: 'SG.sendgrid-value',
  LINEAR_API_KEY: 'lin_api_value',
  LINEAR_TEAM_ID: 'UNI',
  ABR_GUID: 'abr-guid-value',
  NEXT_PUBLIC_SENTRY_DSN: 'https://abc@sentry.example/1',
} as unknown as NodeJS.ProcessEnv

describe('buildAtoAppConnectionStatus', () => {
  it('reports blocked/unknown states when env is empty', () => {
    const status = buildAtoAppConnectionStatus(EMPTY_ENV, '2026-07-02T00:00:00.000Z')
    const byId = Object.fromEntries(status.connections.map((c) => [c.id, c]))

    expect(byId.supabase.state).toBe('blocked')
    expect(byId.xero.state).toBe('blocked')
    expect(byId.myob.state).toBe('blocked')
    expect(byId.quickbooks.state).toBe('blocked')
    expect(byId.google_ai.state).toBe('blocked')
    expect(byId.stripe.state).toBe('blocked')
    expect(byId.sendgrid.state).toBe('blocked')
    expect(byId.linear.state).toBe('blocked')
    expect(byId.abr.state).toBe('blocked')
    expect(byId.sentry.state).toBe('unknown')
    expect(byId.unite_group.state).toBe('ready')
    expect(status.summary.total).toBe(status.connections.length)
    expect(status.summary.blocked).toBeGreaterThan(0)
  })

  it('reports connected/ready states with a fully configured env', () => {
    const status = buildAtoAppConnectionStatus(FULL_ENV, '2026-07-02T00:00:00.000Z')
    const byId = Object.fromEntries(status.connections.map((c) => [c.id, c]))

    expect(byId.supabase.state).toBe('connected')
    expect(byId.sentry.state).toBe('connected')
    expect(byId.xero.state).toBe('ready')
    expect(byId.myob.state).toBe('ready')
    expect(byId.quickbooks.state).toBe('ready')
    expect(byId.google_ai.state).toBe('ready')
    expect(byId.stripe.state).toBe('ready')
    expect(byId.sendgrid.state).toBe('ready')
    expect(byId.linear.state).toBe('ready')
    expect(byId.abr.state).toBe('ready')
    expect(status.project.environment).toBe('production')
    expect(status.summary.blocked).toBe(0)
  })

  it('flags a missing Stripe webhook secret without blocking', () => {
    const env = { ...FULL_ENV, STRIPE_WEBHOOK_SECRET: '' } as NodeJS.ProcessEnv
    const status = buildAtoAppConnectionStatus(env, '2026-07-02T00:00:00.000Z')
    const stripe = status.connections.find((c) => c.id === 'stripe')

    expect(stripe?.state).toBe('ready')
    expect(stripe?.nextAction).toBe('Set STRIPE_WEBHOOK_SECRET.')
  })

  it('never leaks secret values into the payload', () => {
    const status = buildAtoAppConnectionStatus(FULL_ENV, '2026-07-02T00:00:00.000Z')
    const serialized = JSON.stringify(status)

    for (const secret of [
      'xero-client-secret-value',
      'myob-client-secret-value',
      'qb-client-secret-value',
      'google-ai-key-value',
      'sk_test_value',
      'whsec_value',
      'SG.sendgrid-value',
      'lin_api_value',
      'anon-key-value',
      'service-role-value',
      'abr-guid-value',
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })
})
