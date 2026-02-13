import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

// Get auth session
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

// The Supabase SSR cookie is base64-encoded session JSON, possibly chunked
const sessionData = JSON.stringify({
  access_token: auth.session.access_token,
  refresh_token: auth.session.refresh_token,
  expires_in: auth.session.expires_in,
  expires_at: auth.session.expires_at,
  token_type: 'bearer',
  user: auth.session.user
})

// Base64 encode the session
const base64Session = Buffer.from(sessionData).toString('base64')

// Supabase SSR chunks cookies at ~3180 chars
const CHUNK_SIZE = 3180
const cookieName = 'sb-xwqymjisxmtcmaebcehw-auth-token'
const chunks = []
for (let i = 0; i < base64Session.length; i += CHUNK_SIZE) {
  chunks.push(base64Session.slice(i, i + CHUNK_SIZE))
}

// Set cookies before navigating
const cookies = chunks.map((chunk, i) => ({
  name: chunks.length === 1 ? cookieName : `${cookieName}.${i}`,
  value: chunk,
  domain: 'ato-ai.app',
  path: '/',
  secure: true,
  sameSite: 'Lax'
}))

await page.setCookie(...cookies)
console.log(`Set ${cookies.length} auth cookie(s)`)

// Navigate to dashboard
await page.goto('https://ato-ai.app/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
await new Promise(r => setTimeout(r, 6000))  // Wait for client-side hydration + API calls

await page.screenshot({ path: 'C:/ATO/ato-app/screenshot-dashboard.png', fullPage: false })

// Check what we see
const headerText = await page.evaluate(() => {
  const island = document.querySelector('.dynamic-island')
  return island ? island.innerText : 'No dynamic island'
})
console.log('Header:', headerText?.replace(/\n/g, ' | ').substring(0, 300))

const bodyText = await page.evaluate(() => {
  const main = document.querySelector('main') || document.querySelector('[class*="main"]')
  return main ? main.innerText?.substring(0, 200) : document.body.innerText?.substring(0, 200)
})
console.log('Body:', bodyText?.replace(/\n/g, ' | '))

await browser.close()
console.log('Screenshot saved')
