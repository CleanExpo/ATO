/**
 * Share Feedback Types
 *
 * Types for accountant feedback on shared reports.
 * Supports comments, questions, approvals, and concerns.
 */

/**
 * Type of feedback
 */
export type FeedbackType = 'comment' | 'question' | 'approval' | 'concern';

/**
 * Database record for feedback
 */
export interface ShareFeedback {
  id: string;
  share_id: string;
  finding_id: string | null;
  author_name: string;
  author_email: string | null;
  message: string;
  feedback_type: FeedbackType;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  reply_to: string | null;
}

/**
 * Request to create new feedback
 */
export interface CreateFeedbackRequest {
  authorName: string;
  authorEmail?: string;
  message: string;
  feedbackType: FeedbackType;
  findingId?: string;
  replyTo?: string;
}

/**
 * Response after creating feedback
 */
export interface CreateFeedbackResponse {
  success: true;
  feedback: ShareFeedback;
}

/**
 * Feedback with nested replies
 */
export interface FeedbackWithReplies extends ShareFeedback {
  replies: FeedbackWithReplies[];
}

/**
 * Feedback grouped by finding
 */
export interface FeedbackThread {
  findingId: string | null;
  findingTitle: string | null;
  feedback: FeedbackWithReplies[];
  totalCount: number;
  unreadCount: number;
}

/**
 * Response for listing feedback
 */
export interface ListFeedbackResponse {
  threads: FeedbackThread[];
  totalCount: number;
  unreadCount: number;
}

/**
 * Unread count for a share link
 */
export interface UnreadFeedbackCount {
  shareId: string;
  shareTitle: string;
  unreadCount: number;
  latestFeedback?: {
    authorName: string;
    message: string;
    createdAt: string;
    feedbackType: FeedbackType;
  };
}

/**
 * Response for unread counts
 */
export interface UnreadFeedbackResponse {
  counts: UnreadFeedbackCount[];
  totalUnread: number;
}

/**
 * Feedback type styling configuration
 */
export const FEEDBACK_TYPE_CONFIG: Record<FeedbackType, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  comment: {
    label: 'Comment',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: '💬',
  },
  question: {
    label: 'Question',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    icon: '❓',
  },
  approval: {
    label: 'Approval',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon: '✅',
  },
  concern: {
    label: 'Concern',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: '⚠️',
  },
};

/**
 * Format relative time for feedback display
 */
export function formatFeedbackTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return created.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: created.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
