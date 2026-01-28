/**
 * POST /api/slack/test
 *
 * Test Slack webhook integration
 *
 * Sends a test message to verify Slack is configured correctly
 */

import { NextRequest, NextResponse } from 'next/server'
import slack from '@/lib/slack/slack-notifier'

export async function POST(request: NextRequest) {
  try {
    // Send test message
    const testMessage = {
      text: '🎉 Slack Integration Test',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 Slack Integration Test',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Congratulations!* Your Slack webhook is configured correctly for the Australian Tax Optimizer.'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
            },
            {
              type: 'mrkdwn',
              text: '*Status:*\n✅ Connected'
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '💡 You will now receive notifications about user activity, AI analysis progress, payments, and system issues.'
            }
          ]
        }
      ]
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'SLACK_WEBHOOK_URL not configured',
          message: 'Please set SLACK_WEBHOOK_URL environment variable'
        },
        { status: 500 }
      )
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: 'Slack webhook request failed',
          statusCode: response.status,
          statusText: response.statusText,
          details: errorText
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent to Slack successfully!',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error testing Slack webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test message',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Allow GET to show test instructions
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/slack/test',
    method: 'POST',
    description: 'Test Slack webhook integration',
    instructions: [
      '1. Configure SLACK_WEBHOOK_URL environment variable',
      '2. Send POST request to this endpoint',
      '3. Check your Slack channel for test message'
    ],
    example: {
      curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'https://ato.app'}/api/slack/test`
    }
  })
}
