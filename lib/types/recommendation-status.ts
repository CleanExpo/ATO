/**
 * Recommendation Status Types
 *
 * Types for tracking recommendation status through the review workflow.
 * Supports both owner and accountant status updates.
 */

/**
 * Available recommendation statuses in workflow order
 */
export type RecommendationStatus =
  | 'pending_review'
  | 'under_review'
  | 'needs_verification'
  | 'needs_clarification'
  | 'approved'
  | 'rejected'
  | 'implemented';

/**
 * Who updated the status
 */
export type UpdaterType = 'owner' | 'accountant';

/**
 * Database record for status update
 */
export interface StatusUpdate {
  id: string;
  recommendationId: string;
  shareId?: string;
  tenantId: string;
  status: RecommendationStatus;
  updatedByName: string;
  updatedByType: UpdaterType;
  notes?: string;
  createdAt: string;
}

/**
 * Status history for a recommendation
 */
export interface StatusHistory {
  recommendationId: string;
  currentStatus: RecommendationStatus;
  history: StatusUpdate[];
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
}

/**
 * Request to update recommendation status
 */
export interface UpdateStatusRequest {
  recommendationId: string;
  status: RecommendationStatus;
  updatedByName: string;
  notes?: string;
}

/**
 * Response from status update
 */
export interface UpdateStatusResponse {
  success: boolean;
  update: StatusUpdate;
  currentStatus: RecommendationStatus;
}

/**
 * Status counts for dashboard summary
 */
export interface StatusSummary {
  pending_review: number;
  under_review: number;
  needs_verification: number;
  needs_clarification: number;
  approved: number;
  rejected: number;
  implemented: number;
  total: number;
}

/**
 * Response from status summary endpoint
 */
export interface StatusSummaryResponse {
  summary: StatusSummary;
  lastUpdated?: string;
}

/**
 * Configuration for each status type
 */
export interface StatusConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Can accountant set this status? */
  accountantAllowed: boolean;
  /** Can owner set this status? */
  ownerAllowed: boolean;
  /** Suggested next statuses */
  nextStatuses: RecommendationStatus[];
}

/**
 * Status configuration with styling and permissions
 */
export const STATUS_CONFIG: Record<RecommendationStatus, StatusConfig> = {
  pending_review: {
    label: 'Pending Review',
    description: 'Awaiting initial review by accountant',
    icon: '⏳',
    color: 'text-white/60',
    bgColor: 'bg-white/5',
    borderColor: 'border-white/20',
    accountantAllowed: false,
    ownerAllowed: true,
    nextStatuses: ['under_review'],
  },
  under_review: {
    label: 'Under Review',
    description: 'Currently being reviewed by accountant',
    icon: '🔍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    accountantAllowed: true,
    ownerAllowed: true,
    nextStatuses: ['needs_verification', 'needs_clarification', 'approved', 'rejected'],
  },
  needs_verification: {
    label: 'Needs Verification',
    description: 'Requires supporting documentation',
    icon: '📋',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    accountantAllowed: true,
    ownerAllowed: true,
    nextStatuses: ['under_review', 'approved'],
  },
  needs_clarification: {
    label: 'Needs Clarification',
    description: 'Questions need to be answered',
    icon: '❓',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    accountantAllowed: true,
    ownerAllowed: false,
    nextStatuses: ['under_review', 'approved'],
  },
  approved: {
    label: 'Approved',
    description: 'Verified and approved for claiming',
    icon: '✅',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    accountantAllowed: true,
    ownerAllowed: true,
    nextStatuses: ['implemented'],
  },
  rejected: {
    label: 'Rejected',
    description: 'Not valid for claiming',
    icon: '❌',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    accountantAllowed: true,
    ownerAllowed: true,
    nextStatuses: ['under_review', 'pending_review'],
  },
  implemented: {
    label: 'Implemented',
    description: 'Action taken or claim lodged',
    icon: '🎯',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    accountantAllowed: false,
    ownerAllowed: true,
    nextStatuses: [],
  },
};

/**
 * Get valid status transitions based on updater type
 */
export function getValidTransitions(
  currentStatus: RecommendationStatus,
  updaterType: UpdaterType
): RecommendationStatus[] {
  const config = STATUS_CONFIG[currentStatus];
  return config.nextStatuses.filter((status) => {
    const targetConfig = STATUS_CONFIG[status];
    return updaterType === 'owner' ? targetConfig.ownerAllowed : targetConfig.accountantAllowed;
  });
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  fromStatus: RecommendationStatus,
  toStatus: RecommendationStatus,
  updaterType: UpdaterType
): boolean {
  const targetConfig = STATUS_CONFIG[toStatus];

  // Check if updater can set this status
  if (updaterType === 'owner' && !targetConfig.ownerAllowed) {
    return false;
  }
  if (updaterType === 'accountant' && !targetConfig.accountantAllowed) {
    return false;
  }

  // Allow same status (for adding notes)
  if (fromStatus === toStatus) {
    return true;
  }

  // Check if transition is in allowed list
  const fromConfig = STATUS_CONFIG[fromStatus];
  return fromConfig.nextStatuses.includes(toStatus);
}

/**
 * Get all statuses available to a specific updater type
 */
export function getAvailableStatuses(updaterType: UpdaterType): RecommendationStatus[] {
  return (Object.keys(STATUS_CONFIG) as RecommendationStatus[]).filter((status) => {
    const config = STATUS_CONFIG[status];
    return updaterType === 'owner' ? config.ownerAllowed : config.accountantAllowed;
  });
}

/**
 * Format status update timestamp for display
 */
export function formatStatusTime(dateString: string): string {
  const date = new Date(dateString);
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
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default STATUS_CONFIG;
