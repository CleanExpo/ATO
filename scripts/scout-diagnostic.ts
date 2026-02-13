import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scout() {
    const { data: connections } = await supabase.from('xero_connections').select('*');
    if (!connections) return;

    for (const conn of connections) {
        console.log(`ENTITY: ${conn.organisation_name || conn.tenant_name}`);
        const years = ['FY2024-25', 'FY2023-24'];
        for (const fy of years) {
            const { data: results } = await supabase
                .from('forensic_analysis_results')
                .select('*')
                .eq('tenant_id', conn.tenant_id)
                .eq('financial_year', fy);

            if (!results || results.length === 0) continue;

            const turnover = results.reduce((sum, r) => sum + (r.transaction_amount || 0), 0);
            console.log(`  [${fy}] Turnover: $${turnover.toFixed(2)}`);

            if (fy === 'FY2024-25' && turnover >= 500000 && turnover <= 10000000) {
                console.log(`  !! CRITICAL: ELIGIBLE FOR QLD GRANT ($50K+) - DEADLINE TOMORROW !!`);
            }

            const rndValue = results.filter(r => r.is_rnd_candidate).reduce((sum, r) => sum + (r.transaction_amount || 0), 0);
            if (rndValue > 0) {
                console.log(`  >> ${fy} R&D Opportunity: $${(rndValue * 0.435).toFixed(2)} offset`);
            }
        }
        console.log('');
    }
}
scout();
