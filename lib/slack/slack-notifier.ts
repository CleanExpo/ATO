/**
 * Slack Notification Service
 *
 * Sends real-time notifications to Slack for monitoring:
 * - AI analysis progress
 * - User activity (logins, signups)
 * - Payment events
 * - System errors and issues
 * - Tax alert triggers
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

interface SlackMessage {
  text: string
  blocks?: any[]
  attachments?: any[]
}

/**
 * Send a message to Slack
 */
async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL not configured, skipping Slack notification')
    return false
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      console.error('Slack webhook failed:', response.status, response.statusText)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending Slack notification:', error)
    return false
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Format percentage for display
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

// ============================================================================
// USER ACTIVITY NOTIFICATIONS
// ============================================================================

/**
 * Notify when a new user signs up
 */
export async function notifyUserSignup(userId: string, email: string, method: string): Promise<void> {
  await sendSlackMessage({
    text: `🎉 New User Signup`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 New User Signup',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Email:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Method:*\n${method}`
          },
          {
            type: 'mrkdwn',
            text: `*User ID:*\n\`${userId}\``
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 New user registered on Australian Tax Optimizer'
          }
        ]
      }
    ]
  })
}

/**
 * Notify when a user connects an accounting platform
 */
export async function notifyPlatformConnection(
  userId: string,
  email: string,
  platform: 'xero' | 'myob' | 'quickbooks',
  organisationName?: string
): Promise<void> {
  const platformEmoji = {
    xero: '🔵',
    myob: '🟢',
    quickbooks: '🟢'
  }

  await sendSlackMessage({
    text: `${platformEmoji[platform]} Platform Connected: ${platform.toUpperCase()}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${platformEmoji[platform]} Platform Connected`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Platform:*\n${platform.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Organisation:*\n${organisationName || 'N/A'}`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      }
    ]
  })
}

/**
 * Notify about active users (daily summary)
 */
export async function notifyDailyActiveUsers(
  totalUsers: number,
  activeToday: number,
  newSignups: number
): Promise<void> {
  await sendSlackMessage({
    text: `📊 Daily Active Users Report`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Active Users Report',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Users:*\n${totalUsers}`
          },
          {
            type: 'mrkdwn',
            text: `*Active Today:*\n${activeToday} (${formatPercentage((activeToday / totalUsers) * 100)})`
          },
          {
            type: 'mrkdwn',
            text: `*New Signups:*\n${newSignups}`
          },
          {
            type: 'mrkdwn',
            text: `*Date:*\n${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      }
    ]
  })
}

// ============================================================================
// AI ANALYSIS NOTIFICATIONS
// ============================================================================

/**
 * Notify when AI analysis starts
 */
export async function notifyAnalysisStarted(
  userId: string,
  email: string,
  platform: string,
  totalTransactions: number
): Promise<void> {
  await sendSlackMessage({
    text: `🔬 AI Analysis Started`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔬 AI Analysis Started',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Platform:*\n${platform.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Transactions:*\n${totalTransactions.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n🟡 In Progress`
          }
        ]
      }
    ]
  })
}

/**
 * Notify when AI analysis completes
 */
export async function notifyAnalysisComplete(
  userId: string,
  email: string,
  platform: string,
  stats: {
    totalTransactions: number
    rndCandidates: number
    potentialRndBenefit: number
    deductionOpportunities: number
    potentialDeductions: number
    analysisTimeMinutes: number
    costUSD: number
  }
): Promise<void> {
  const successRate = ((stats.rndCandidates / stats.totalTransactions) * 100).toFixed(1)

  await sendSlackMessage({
    text: `✅ AI Analysis Complete`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ AI Analysis Complete',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Platform:*\n${platform.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Transactions:*\n${stats.totalTransactions.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Duration:*\n${stats.analysisTimeMinutes.toFixed(1)} minutes`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Key Findings:*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*R&D Candidates:*\n${stats.rndCandidates} transactions (${successRate}%)`
          },
          {
            type: 'mrkdwn',
            text: `*Potential R&D Benefit:*\n${formatCurrency(stats.potentialRndBenefit)}`
          },
          {
            type: 'mrkdwn',
            text: `*Deduction Opportunities:*\n${stats.deductionOpportunities} opportunities`
          },
          {
            type: 'mrkdwn',
            text: `*Potential Deductions:*\n${formatCurrency(stats.potentialDeductions)}`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Analysis Cost:*\n$${stats.costUSD.toFixed(4)} USD`
          },
          {
            type: 'mrkdwn',
            text: `*ROI:*\n${((stats.potentialRndBenefit + stats.potentialDeductions) / stats.costUSD).toFixed(0)}x`
          }
        ]
      }
    ]
  })
}

/**
 * Notify about analysis progress (milestone updates)
 */
export async function notifyAnalysisProgress(
  userId: string,
  email: string,
  platform: string,
  progress: number,
  transactionsAnalyzed: number,
  totalTransactions: number
): Promise<void> {
  // Only notify at 25%, 50%, 75% milestones
  const milestones = [25, 50, 75]
  if (!milestones.includes(Math.floor(progress))) return

  await sendSlackMessage({
    text: `📊 Analysis Progress: ${progress.toFixed(0)}%`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Analysis Progress:* ${progress.toFixed(0)}%\n*User:* ${email}\n*Platform:* ${platform.toUpperCase()}\n*Progress:* ${transactionsAnalyzed.toLocaleString()} / ${totalTransactions.toLocaleString()} transactions`
        }
      }
    ]
  })
}

// ============================================================================
// TAX ALERT NOTIFICATIONS
// ============================================================================

/**
 * Notify when critical tax alerts are generated
 */
export async function notifyCriticalAlert(
  userId: string,
  email: string,
  alert: {
    title: string
    message: string
    category: string
    potentialBenefit?: number
    dueDate?: string
  }
): Promise<void> {
  await sendSlackMessage({
    text: `🚨 Critical Tax Alert`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Critical Tax Alert',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Category:*\n${alert.category}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${alert.title}*\n${alert.message}`
        }
      },
      ...(alert.potentialBenefit ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💰 *Potential Benefit:* ${formatCurrency(alert.potentialBenefit)}`
        }
      }] : []),
      ...(alert.dueDate ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📅 *Due Date:* ${new Date(alert.dueDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`
        }
      }] : [])
    ]
  })
}

// ============================================================================
// PAYMENT NOTIFICATIONS
// ============================================================================

/**
 * Notify about subscription payments
 */
export async function notifyPaymentReceived(
  userId: string,
  email: string,
  amount: number,
  plan: string,
  paymentMethod: string
): Promise<void> {
  await sendSlackMessage({
    text: `💳 Payment Received`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💳 Payment Received',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n${formatCurrency(amount)}`
          },
          {
            type: 'mrkdwn',
            text: `*Plan:*\n${plan}`
          },
          {
            type: 'mrkdwn',
            text: `*Payment Method:*\n${paymentMethod}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `✅ Payment processed successfully at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      }
    ]
  })
}

/**
 * Notify about failed payments
 */
export async function notifyPaymentFailed(
  userId: string,
  email: string,
  amount: number,
  plan: string,
  reason: string
): Promise<void> {
  await sendSlackMessage({
    text: `❌ Payment Failed`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Payment Failed',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${email}`
          },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n${formatCurrency(amount)}`
          },
          {
            type: 'mrkdwn',
            text: `*Plan:*\n${plan}`
          },
          {
            type: 'mrkdwn',
            text: `*Reason:*\n${reason}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⚠️ Action required: Contact user to update payment method`
          }
        ]
      }
    ]
  })
}

/**
 * Daily revenue summary
 */
export async function notifyDailyRevenue(
  totalRevenue: number,
  newSubscriptions: number,
  churnedSubscriptions: number,
  totalActiveSubscriptions: number
): Promise<void> {
  await sendSlackMessage({
    text: `💰 Daily Revenue Report`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💰 Daily Revenue Report',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Revenue (Today):*\n${formatCurrency(totalRevenue)}`
          },
          {
            type: 'mrkdwn',
            text: `*New Subscriptions:*\n${newSubscriptions}`
          },
          {
            type: 'mrkdwn',
            text: `*Churned Subscriptions:*\n${churnedSubscriptions}`
          },
          {
            type: 'mrkdwn',
            text: `*Active Subscriptions:*\n${totalActiveSubscriptions}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 Report for ${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      }
    ]
  })
}

// ============================================================================
// ERROR & ISSUE NOTIFICATIONS
// ============================================================================

/**
 * Notify about critical system errors
 */
export async function notifyError(
  errorType: string,
  errorMessage: string,
  context?: {
    userId?: string
    endpoint?: string
    stackTrace?: string
  }
): Promise<void> {
  await sendSlackMessage({
    text: `🔴 Critical Error: ${errorType}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🔴 Critical Error`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Error Type:*\n${errorType}`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          },
          ...(context?.userId ? [{
            type: 'mrkdwn',
            text: `*User ID:*\n\`${context.userId}\``
          }] : []),
          ...(context?.endpoint ? [{
            type: 'mrkdwn',
            text: `*Endpoint:*\n\`${context.endpoint}\``
          }] : [])
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n\`\`\`${errorMessage}\`\`\``
        }
      },
      ...(context?.stackTrace ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`${context.stackTrace.substring(0, 500)}...\`\`\``
        }
      }] : [])
    ]
  })
}

/**
 * Notify about API rate limit issues
 */
export async function notifyRateLimitHit(
  service: string,
  userId: string,
  endpoint: string
): Promise<void> {
  await sendSlackMessage({
    text: `⚠️ Rate Limit Hit: ${service}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Rate Limit Hit',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service:*\n${service}`
          },
          {
            type: 'mrkdwn',
            text: `*User ID:*\n\`${userId}\``
          },
          {
            type: 'mrkdwn',
            text: `*Endpoint:*\n\`${endpoint}\``
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 Consider implementing request throttling or upgrading API plan'
          }
        ]
      }
    ]
  })
}

/**
 * Notify about system health issues
 */
export async function notifySystemHealth(
  metric: string,
  currentValue: number,
  threshold: number,
  status: 'warning' | 'critical'
): Promise<void> {
  const emoji = status === 'critical' ? '🔴' : '⚠️'

  await sendSlackMessage({
    text: `${emoji} System Health Alert: ${metric}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} System Health Alert`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Metric:*\n${metric}`
          },
          {
            type: 'mrkdwn',
            text: `*Current Value:*\n${currentValue}`
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n${threshold}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${status === 'critical' ? '🔴 CRITICAL' : '⚠️ WARNING'}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Detected at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`
          }
        ]
      }
    ]
  })
}

// ============================================================================
// DAILY SUMMARY
// ============================================================================

/**
 * Send comprehensive daily summary
 */
export async function notifyDailySummary(summary: {
  date: string
  users: {
    total: number
    active: number
    newSignups: number
  }
  analysis: {
    totalAnalyses: number
    totalTransactions: number
    totalRndBenefit: number
    totalCostUSD: number
  }
  alerts: {
    totalAlerts: number
    criticalAlerts: number
  }
  revenue: {
    totalRevenue: number
    newSubscriptions: number
    churnedSubscriptions: number
  }
  errors: {
    totalErrors: number
    criticalErrors: number
  }
}): Promise<void> {
  await sendSlackMessage({
    text: `📊 Daily Summary Report`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Summary Report',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Date:* ${summary.date}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*👥 User Activity*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Users:*\n${summary.users.total}`
          },
          {
            type: 'mrkdwn',
            text: `*Active Today:*\n${summary.users.active} (${formatPercentage((summary.users.active / summary.users.total) * 100)})`
          },
          {
            type: 'mrkdwn',
            text: `*New Signups:*\n${summary.users.newSignups}`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔬 AI Analysis*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Analyses Run:*\n${summary.analysis.totalAnalyses}`
          },
          {
            type: 'mrkdwn',
            text: `*Transactions Analyzed:*\n${summary.analysis.totalTransactions.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*R&D Benefit Identified:*\n${formatCurrency(summary.analysis.totalRndBenefit)}`
          },
          {
            type: 'mrkdwn',
            text: `*Analysis Cost:*\n$${summary.analysis.totalCostUSD.toFixed(2)} USD`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔔 Tax Alerts*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Alerts:*\n${summary.alerts.totalAlerts}`
          },
          {
            type: 'mrkdwn',
            text: `*Critical Alerts:*\n${summary.alerts.criticalAlerts}`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💰 Revenue*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Revenue:*\n${formatCurrency(summary.revenue.totalRevenue)}`
          },
          {
            type: 'mrkdwn',
            text: `*New Subscriptions:*\n${summary.revenue.newSubscriptions}`
          },
          {
            type: 'mrkdwn',
            text: `*Churned Subscriptions:*\n${summary.revenue.churnedSubscriptions}`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*⚠️ System Health*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Errors:*\n${summary.errors.totalErrors}`
          },
          {
            type: 'mrkdwn',
            text: `*Critical Errors:*\n${summary.errors.criticalErrors}`
          }
        ]
      }
    ]
  })
}

export default {
  // User activity
  notifyUserSignup,
  notifyPlatformConnection,
  notifyDailyActiveUsers,

  // AI analysis
  notifyAnalysisStarted,
  notifyAnalysisComplete,
  notifyAnalysisProgress,

  // Tax alerts
  notifyCriticalAlert,

  // Payments
  notifyPaymentReceived,
  notifyPaymentFailed,
  notifyDailyRevenue,

  // Errors & issues
  notifyError,
  notifyRateLimitHit,
  notifySystemHealth,

  // Daily summary
  notifyDailySummary
}
