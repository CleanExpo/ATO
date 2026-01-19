import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns/promises'
import pg from 'pg'

const { Client } = pg

function loadEnvFile(envPath) {
    const env = {}
    const raw = fs.readFileSync(envPath, 'utf8')

    for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
            continue
        }
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (!match) {
            continue
        }
        const key = match[1].trim()
        let value = match[2].trim()
        value = value.replace(/^['"]|['"]$/g, '')
        env[key] = value
    }

    return env
}

async function applyMigration() {
    const root = path.resolve(process.cwd())
    const envPath = path.join(root, '.env.local')
    const migrationPath = path.join(root, 'supabase', 'migrations', '002_add_user_id_to_xero_connections.sql')

    if (!fs.existsSync(envPath)) {
        throw new Error(`Missing ${envPath}`)
    }
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Missing ${migrationPath}`)
    }

    const env = loadEnvFile(envPath)
    const databaseUrl = env.DATABASE_URL

    if (!databaseUrl) {
        console.error('ERROR: DATABASE_URL not found in .env.local')
        console.error('This script requires direct database access for manual migrations.')
        console.error('For Supabase, run migrations via Dashboard (Settings → Database → Migrations)')
        console.error('Or add DATABASE_URL to .env.local: postgresql://[user]:[pass]@[host]:[port]/[db]')
        process.exit(1)
    }

    const sql = fs.readFileSync(migrationPath, 'utf8')
    const parsed = new URL(databaseUrl)
    let host = parsed.hostname

    try {
        const [ipv6] = await dns.resolve6(parsed.hostname)
        if (ipv6) {
            host = ipv6
        }
    } catch {
        try {
            const [ipv4] = await dns.resolve4(parsed.hostname)
            if (ipv4) {
                host = ipv4
            }
        } catch {
            // Fallback to hostname if DNS resolution fails.
        }
    }

    const client = new Client({
        host,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace('/', ''),
        ssl: { rejectUnauthorized: false },
    })

    await client.connect()
    try {
        await client.query(sql)
        console.log('Migration applied successfully.')
    } finally {
        await client.end()
    }
}

applyMigration().catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
})
