import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  const { error } = await supabase
    .from('work_queue')
    .update({
      status: 'pending',
      linear_issue_id: null,
      linear_issue_identifier: null,
      linear_issue_url: null,
    })
    .in('status', ['validated', 'validating']);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Reset items to pending');
  }
})();
