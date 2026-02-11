import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

// Get auth session first
const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.7BUiIFURS9QclDEY5kYgahba6I6yQpmQKwJ2Xk2SetE'
)

const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'phill.mcgurk@gmail.com',
  password: 'q3XgPwyathfrSAgXwXTRPg'
})

if (!auth?.session) {
  console.error('Auth failed')
  process.exit(1)
}

console.log('Authenticated as:', auth.user.email)

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080']
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })

// Navigate to dashboard and set auth cookies
await page.goto('https://ato-ai.app/dashboard', { waitUntil: 'domcontentloaded' })

// Set Supabase auth cookie
const cookieValue = JSON.stringify([
  auth.session.access_token,
  auth.session.refresh_token,
  null, null, null
])

await page.setCookie({
  name: `sb-xwqymjisxmtcmaebcehw-auth-token`,
  value: cookieValue,
  domain: 'ato-ai.app',
  path: '/',
  httpOnly: false,
  secure: true,
  sameSite: 'Lax'
})

// Also set the base64 encoded versions that Supabase SSR uses
const base64Value = Buffer.from(cookieValue).toString('base64')
await page.setCookie({
  name: `sb-xwqymjisxmtcmaebcehw-auth-token.0`,
  value: base64Value,
  domain: 'ato-ai.app',
  path: '/',
  httpOnly: false,
  secure: true,
  sameSite: 'Lax'
})

// Reload with cookies
await page.goto('https://ato-ai.app/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })

// Wait for the page to render
await new Promise(r => setTimeout(r, 5000))

// Take screenshot
await page.screenshot({ path: 'C:/ATO/ato-app/screenshot-dashboard.png', fullPage: false })
console.log('Screenshot saved')

// Also get page content for debugging
const title = await page.title()
console.log('Page title:', title)

// Check for org switcher or step indicators
const headerText = await page.evaluate(() => {
  const header = document.querySelector('.dynamic-island')
  return header ? header.textContent : 'No dynamic island found'
})
console.log('Header:', headerText?.substring(0, 200))

// Check org switcher
const orgSwitcher = await page.evaluate(() => {
  const btn = document.querySelector('.relative button')
  return btn ? btn.textContent : 'No org switcher'
})
console.log('Org switcher:', orgSwitcher)

await browser.close()
