import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTE3MjksImV4cCI6MjA4NDM2NzcyOX0.7BUiIFURS9QclDEY5kYgahba6I6yQpmQKwJ2Xk2SetE'
)

// Sign in to get token
const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'phill.mcgurk@gmail.com',
  password: 'q3XgPwyathfrSAgXwXTRPg'
})

const token = auth?.session?.access_token
console.log('Auth token:', token ? 'OK' : 'FAILED')

// Test the organizations API
const res = await fetch('https://ato-ai.app/api/organizations', {
  headers: {
    'Cookie': `sb-xwqymjisxmtcmaebcehw-auth-token=${encodeURIComponent(JSON.stringify([token, auth?.session?.refresh_token, null, null, null]))}`
  }
})

console.log('Status:', res.status)
const data = await res.json()
console.log('Response:', JSON.stringify(data, null, 2))
