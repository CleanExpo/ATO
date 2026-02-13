import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.7BUiIFURS9QclDEY5kYgahba6I6yQpmQKwJ2Xk2SetE'
)

const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'phill.mcgurk@gmail.com',
  password: 'q3XgPwyathfrSAgXwXTRPg'
})
if (!auth?.session) { console.error('Auth failed'); process.exit(1) }
console.log('Authenticated')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1920,1080'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })

const sessionJSON = JSON.stringify({
  access_token: auth.session.access_token,
  refresh_token: auth.session.refresh_token,
  expires_in: auth.session.expires_in,
  expires_at: auth.session.expires_at,
  token_type: 'bearer',
  user: auth.session.user
})

await page.setCookie({
  name: 'sb-xwqymjisxmtcmaebcehw-auth-token',
  value: sessionJSON,
  domain: 'ato-ai.app',
  path: '/',
  secure: true,
  sameSite: 'Lax'
})

// Capture ALL failed responses (4xx/5xx)
page.on('response', async (response) => {
  const status = response.status()
  if (status >= 400) {
    const url = response.url()
    // Log ALL errors — no filtering
    try {
      const body = await response.text()
      console.log(`HTTP ${status} ${url}: ${body.substring(0, 300)}`)
    } catch {
      console.log(`HTTP ${status} ${url}: (body unreadable)`)
    }
  }
})

// Capture console errors (skip WebSocket reconnect noise)
page.on('console', msg => {
  if (msg.type() === 'error') {
    const text = msg.text()
    if (!text.includes('wss://') && !text.includes('Connecting to')) {
      console.log(`CONSOLE ERROR: ${text.substring(0, 300)}`)
    }
  }
})

// Capture failed requests (network level)
page.on('requestfailed', request => {
  console.log(`REQUEST FAILED: ${request.url()} — ${request.failure()?.errorText}`)
})

console.log('\nNavigating to dashboard...')
await page.goto('https://ato-ai.app/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
await new Promise(r => setTimeout(r, 8000))

await page.screenshot({ path: 'C:/ATO/ato-app/screenshot-debug.png', fullPage: false })

const pageState = await page.evaluate(() => {
  const body = document.body?.innerText?.substring(0, 600)
  return {
    url: window.location.href,
    hasLiveData: body?.includes('LIVE DATA') || false,
    hasConnectPrompt: body?.includes('Connect Your Data') || false,
    bodyPreview: body?.replace(/\n/g, ' | ')
  }
})

// Check CSP header
const csp = await page.evaluate(() => {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  return meta?.getAttribute('content') || 'no meta CSP'
})
console.log('\n--- CSP ---')
console.log(csp)

console.log('\n--- Page State ---')
console.log('URL:', pageState.url)
console.log('LIVE DATA:', pageState.hasLiveData)
console.log('Connect prompt:', pageState.hasConnectPrompt)
console.log('Body:', pageState.bodyPreview?.substring(0, 400))

await browser.close()
