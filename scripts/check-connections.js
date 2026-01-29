const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function getEnv() {
    const envPath = path.join(__dirname, '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim();
        }
    });
    return env;
}

async function checkConnections() {
    const env = getEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
        .from('xero_connections')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Connections found:', data.length);
        data.forEach(conn => {
            console.log(`- ${conn.tenant_name} (${conn.tenant_id})`);
        });
    }
}

checkConnections();
