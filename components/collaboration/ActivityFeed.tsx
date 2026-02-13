'use client';

import { useState, useEffect } from 'react';
import { Clock, User, Settings, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useRealtimeActivity } from '@/lib/hooks/useRealtimeActivity';

interface ActivityItem {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

interface ActivityFeedProps {
  organizationId?: string;
  limit?: number;
  className?: string;
}

export default function ActivityFeed({
  organizationId,
  limit = 20,
  className = ''
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Setup real-time subscription for new activity
  useRealtimeActivity({
    organizationId,
    onActivityLogged: (activity) => {
      // Add new activity to the top of the list
      setActivities(prev => [activity, ...prev]);
    }
  });

  useEffect(() => {
    fetchActivities();
  }, [organizationId, offset]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/activity?limit=${limit}&offset=${offset}`;
      if (organizationId) {
        url = `/api/organizations/${organizationId}/activity?limit=${limit}&offset=${offset}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch activity feed');
      }

      const data = await response.json();

      if (offset === 0) {
        setActivities(data.activities);
      } else {
        setActivities(prev => [...prev, ...data.activities]);
      }

      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setOffset(prev => prev + limit);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'member_added':
      case 'member_removed':
      case 'member_role_changed':
        return <User className="w-4 h-4" />;
      case 'xero_connected':
      case 'xero_disconnected':
      case 'quickbooks_connected':
      case 'myob_connected':
        return <LinkIcon className="w-4 h-4" />;
      case 'settings_updated':
        return <Settings className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatAction = (activity: ActivityItem): string => {
    const userName = activity.user?.full_name || activity.user?.email || 'Someone';

    switch (activity.action) {
      case 'member_added':
        return `${userName} added a new team member`;
      case 'member_removed':
        return `${userName} removed a team member`;
      case 'member_role_changed':
        return `${userName} changed a member's role`;
      case 'xero_connected':
        return `${userName} connected Xero`;
      case 'xero_disconnected':
        return `${userName} disconnected Xero`;
      case 'quickbooks_connected':
        return `${userName} connected QuickBooks`;
      case 'myob_connected':
        return `${userName} connected MYOB`;
      case 'settings_updated':
        return `${userName} updated organization settings`;
      case 'audit_started':
        return `${userName} started a tax audit`;
      case 'audit_completed':
        return `${userName} completed a tax audit`;
      case 'report_generated':
        return `${userName} generated a report`;
      default:
        return `${userName} performed an action`;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading && offset === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg ${className}`}>
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">No activity yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Activity will appear here as your team uses the platform
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
            {getActionIcon(activity.action)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {formatAction(activity)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatTimestamp(activity.created_at)}
            </p>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
