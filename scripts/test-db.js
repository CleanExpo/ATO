const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testConnection() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        console.error('❌ Missing Supabase credentials in .env.local')
        process.exit(1)
    }

    const supabase = createClient(url, key)

    try {
        const { data, error } = await supabase
            .from('xero_connections')
            .select('id')
            .limit(1)

        if (error) {
            console.error('❌ Supabase Table Error:', error.message)
            process.exit(1)
        } else {
            console.log('✅ Supabase Connection Successful')
            console.log('✅ xero_connections table is accessible')
            process.exit(0)
        }
    } catch (err) {
        console.error('❌ System Error:', err.message)
        process.exit(1)
    }
}

testConnection()
