/**
 * useRealtimeNotifications
 *
 * Hook to subscribe to real-time notification updates via Supabase Realtime.
 * Automatically updates notification count and list when new notifications arrive.
 */

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('hooks:realtime-notifications');

interface Notification {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  [key: string]: any;
}

interface UseRealtimeNotificationsOptions {
  userId?: string;
  onNotificationReceived?: (notification: Notification) => void;
  onNotificationUpdated?: (notification: Notification) => void;
  onNotificationDeleted?: (id: string) => void;
}

export function useRealtimeNotifications({
  userId,
  onNotificationReceived,
  onNotificationUpdated,
  onNotificationDeleted,
}: UseRealtimeNotificationsOptions = {}) {
  const supabase = createClient();

  const setupRealtimeSubscription = useCallback(async () => {
    if (!userId) {
      // Get current user if not provided
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      userId = user.id;
    }

    // Subscribe to notifications for this user
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          log.debug('New notification received', { payload });
          if (onNotificationReceived) {
            onNotificationReceived(payload.new as Notification);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          log.debug('Notification updated', { payload });
          if (onNotificationUpdated) {
            onNotificationUpdated(payload.new as Notification);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          log.debug('Notification deleted', { payload });
          if (onNotificationDeleted) {
            onNotificationDeleted(payload.old.id);
          }
        }
      )
      .subscribe();

    return channel;
  }, [userId, onNotificationReceived, onNotificationUpdated, onNotificationDeleted]);

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
