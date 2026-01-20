/**
 * Clear previous scan data to start fresh
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xwqymjisxmtcmaebcehw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXltamlzeG10Y21hZWJjZWh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5MTcyOSwiZXhwIjoyMDg0MzY3NzI5fQ.2g8zfRA7j63YQMcBP42R68EsIlBGjPI65-WUNIoIGLo'
);

const tenantId = '8a8caf6c-614b-45a5-9e15-46375122407c';

console.log('🧹 Clearing previous scan data...');

// Clear data quality issues
const { error: issuesError } = await supabase
  .from('data_quality_issues')
  .delete()
  .eq('tenant_id', tenantId);

if (issuesError) {
  console.error('Error clearing issues:', issuesError.message);
} else {
  console.log('✅ Cleared data_quality_issues');
}

// Reset scan status
const { error: statusError } = await supabase
  .from('data_quality_scan_status')
  .delete()
  .eq('tenant_id', tenantId);

if (statusError) {
  console.error('Error clearing status:', statusError.message);
} else {
  console.log('✅ Cleared scan status');
}

console.log('✅ Ready for fresh comprehensive scan!\n');
