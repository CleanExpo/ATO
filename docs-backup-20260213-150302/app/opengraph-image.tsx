import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ATO Tax Optimizer - AI-Powered Forensic Tax Analysis for Australian Businesses'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #050505 0%, #0a1628 50%, #050505 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #00F5FF, #10B981, #00F5FF)',
          }}
        />

        {/* Logo circle */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            border: '2px solid #00F5FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 900, color: '#00F5FF' }}>A</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            margin: 0,
            marginBottom: 16,
          }}
        >
          ATO Tax Optimizer
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 24,
            color: '#00F5FF',
            fontWeight: 600,
            margin: 0,
            marginBottom: 40,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
          }}
        >
          AI-Powered Forensic Tax Analysis
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['Xero Integration', 'R&D Tax Incentive', 'Division 7A', 'Loss Recovery'].map(
            (feature) => (
              <div
                key={feature}
                style={{
                  padding: '10px 24px',
                  borderRadius: 9999,
                  border: '1px solid rgba(0, 245, 255, 0.3)',
                  background: 'rgba(0, 245, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {feature}
              </div>
            )
          )}
        </div>

        {/* Bottom tagline */}
        <p
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 500,
          }}
        >
          Recover $200K-$500K in unclaimed tax benefits for Australian businesses
        </p>
      </div>
    ),
    { ...size }
  )
}
