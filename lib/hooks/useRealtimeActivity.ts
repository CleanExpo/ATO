/**
 * useRealtimeActivity
 *
 * Hook to subscribe to real-time activity log updates via Supabase Realtime.
 * Automatically updates activity feed when new activities are logged.
 */

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('hooks:realtime-activity');

interface ActivityLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface UseRealtimeActivityOptions {
  organizationId?: string;
  onActivityLogged?: (activity: ActivityLog) => void;
}

export function useRealtimeActivity({
  organizationId,
  onActivityLogged,
}: UseRealtimeActivityOptions = {}) {
  const supabase = createClient();

  const setupRealtimeSubscription = useCallback(async () => {
    if (!organizationId) {
      console.warn('No organizationId provided for activity subscription');
      return null;
    }

    // Subscribe to activity logs for this organization
    const channel = supabase
      .channel(`activity-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'organization_activity_log',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          log.debug('New activity logged', { payload });
          if (onActivityLogged) {
            onActivityLogged(payload.new as ActivityLog);
          }
        }
      )
      .subscribe();

    return channel;
  }, [organizationId, onActivityLogged]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    setupRealtimeSubscription().then((ch) => {
      channel = ch;
    });

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [setupRealtimeSubscription]);
}
