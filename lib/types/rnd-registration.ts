/**
 * R&D Registration Types
 *
 * Types for tracking R&D Tax Incentive (Division 355 ITAA 1997) registration
 * status and deadlines per financial year.
 */

/**
 * Registration status for R&D Tax Incentive
 */
export type RndRegistrationStatus =
  | 'not_started'   // Registration not yet begun
  | 'in_progress'   // Currently preparing registration
  | 'submitted'     // Submitted to AusIndustry
  | 'approved'      // Registration approved by AusIndustry
  | 'rejected';     // Registration rejected (can be resubmitted)

/**
 * Reminder type for deadline alerts
 */
export type RndReminderType = '90_days' | '60_days' | '30_days' | '7_days';

/**
 * Urgency level for deadline tracking
 */
export type DeadlineUrgency =
  | 'completed'    // Already registered
  | 'overdue'      // Past deadline
  | 'critical'     // 7 days or less
  | 'urgent'       // 30 days or less
  | 'approaching'  // 90 days or less
  | 'open';        // More than 90 days

/**
 * R&D Registration record from database
 */
export interface RndRegistration {
  id: string;
  tenantId: string;
  financialYear: string;          // e.g., 'FY2024-25'
  registrationStatus: RndRegistrationStatus;
  ausindustryReference?: string;  // Reference number from AusIndustry
  submissionDate?: string;        // ISO timestamp
  approvalDate?: string;          // ISO timestamp
  deadlineDate: string;           // YYYY-MM-DD format
  eligibleExpenditure?: number;   // Total eligible R&D expenditure
  estimatedOffset?: number;       // 43.5% of eligible expenditure
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deadline reminder record from database
 */
export interface RndDeadlineReminder {
  id: string;
  tenantId: string;
  financialYear: string;
  reminderType: RndReminderType;
  scheduledDate: string;          // YYYY-MM-DD format
  sentAt?: string;                // ISO timestamp (NULL if pending)
  dismissedAt?: string;           // ISO timestamp (NULL if not dismissed)
  createdAt: string;
}

/**
 * Extended registration with computed urgency fields
 */
export interface RndRegistrationWithUrgency extends RndRegistration {
  urgencyLevel: DeadlineUrgency;
  daysUntilDeadline: number;
}

/**
 * Request to create or update a registration
 */
export interface CreateRndRegistrationRequest {
  tenantId: string;
  financialYear: string;
  registrationStatus?: RndRegistrationStatus;
  ausindustryReference?: string;
  submissionDate?: string;
  approvalDate?: string;
  eligibleExpenditure?: number;
  estimatedOffset?: number;
  notes?: string;
}

/**
 * Request to update registration status
 */
export interface UpdateRndRegistrationRequest {
  registrationStatus?: RndRegistrationStatus;
  ausindustryReference?: string;
  submissionDate?: string;
  approvalDate?: string;
  eligibleExpenditure?: number;
  estimatedOffset?: number;
  notes?: string;
}

/**
 * Deadline summary for dashboard display
 */
export interface RndDeadlineSummary {
  financialYear: string;
  deadlineDate: string;
  daysUntilDeadline: number;
  urgencyLevel: DeadlineUrgency;
  registrationStatus: RndRegistrationStatus;
  eligibleExpenditure?: number;
  estimatedOffset?: number;
  ausindustryReference?: string;
}

/**
 * Status configuration for UI styling
 */
export interface RndStatusConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Status configuration with styling
 */
export const RND_STATUS_CONFIG: Record<RndRegistrationStatus, RndStatusConfig> = {
  not_started: {
    label: 'Not Started',
    description: 'Registration not yet begun',
    icon: 'o',  // Circle outline
    color: 'rgba(255, 255, 255, 0.6)',
    bgColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  in_progress: {
    label: 'In Progress',
    description: 'Currently preparing registration',
    icon: '~',  // Progress indicator
    color: '#00F5FF',
    bgColor: 'rgba(0, 245, 255, 0.1)',
    borderColor: 'rgba(0, 245, 255, 0.3)',
  },
  submitted: {
    label: 'Submitted',
    description: 'Submitted to AusIndustry',
    icon: '>',  // Arrow right
    color: '#FFB800',
    bgColor: 'rgba(255, 184, 0, 0.1)',
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  approved: {
    label: 'Approved',
    description: 'Registration approved by AusIndustry',
    icon: '+',  // Check mark
    color: '#00FF88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  rejected: {
    label: 'Rejected',
    description: 'Registration rejected - review and resubmit',
    icon: 'x',  // X mark
    color: '#FF4444',
    bgColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
};

/**
 * Urgency level configuration for UI styling
 */
export interface UrgencyConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  priority: number;
}

export const URGENCY_CONFIG: Record<DeadlineUrgency, UrgencyConfig> = {
  completed: {
    label: 'Completed',
    color: '#00FF88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    priority: 0,
  },
  overdue: {
    label: 'Overdue',
    color: '#FF4444',
    bgColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
    priority: 5,
  },
  critical: {
    label: 'Critical',
    color: '#FF4444',
    bgColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
    priority: 4,
  },
  urgent: {
    label: 'Urgent',
    color: '#FF8800',
    bgColor: 'rgba(255, 136, 0, 0.1)',
    borderColor: 'rgba(255, 136, 0, 0.3)',
    priority: 3,
  },
  approaching: {
    label: 'Approaching',
    color: '#FFB800',
    bgColor: 'rgba(255, 184, 0, 0.1)',
    borderColor: 'rgba(255, 184, 0, 0.3)',
    priority: 2,
  },
  open: {
    label: 'Open',
    color: 'rgba(255, 255, 255, 0.6)',
    bgColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    priority: 1,
  },
};

/**
 * Calculate registration deadline from financial year
 * Division 355 ITAA 1997: 10 months after end of financial year
 *
 * @param financialYear - e.g., 'FY2024-25'
 * @returns ISO date string (YYYY-MM-DD)
 */
export function calculateDeadlineFromFY(financialYear: string): string {
  // Financial year format: "FY2024-25" means July 1, 2024 to June 30, 2025
  const match = financialYear.match(/FY\d{4}-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid financial year format: ${financialYear}`);
  }

  const endYearShort = parseInt(match[1], 10);
  const endYear = endYearShort < 50 ? 2000 + endYearShort : 1900 + endYearShort;

  // FY ends June 30, deadline is 10 months later = April 30 of next year
  // But since June 30 + 10 months = April 30, we can directly set April 30
  const deadline = new Date(endYear + 1, 3, 30); // April is month 3 (0-indexed)

  return deadline.toISOString().split('T')[0];
}

/**
 * Calculate days until deadline from a deadline date
 *
 * @param deadlineDate - YYYY-MM-DD format
 * @returns Number of days (negative if overdue)
 */
export function calculateDaysUntilDeadline(deadlineDate: string): number {
  const deadline = new Date(deadlineDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diffMs = deadline.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate urgency level from days until deadline and registration status
 *
 * @param daysUntilDeadline - Days until deadline (negative if overdue)
 * @param status - Current registration status
 * @returns Urgency level
 */
export function calculateUrgencyLevel(
  daysUntilDeadline: number,
  status: RndRegistrationStatus
): DeadlineUrgency {
  if (status === 'submitted' || status === 'approved') {
    return 'completed';
  }

  if (daysUntilDeadline < 0) {
    return 'overdue';
  }

  if (daysUntilDeadline <= 7) {
    return 'critical';
  }

  if (daysUntilDeadline <= 30) {
    return 'urgent';
  }

  if (daysUntilDeadline <= 90) {
    return 'approaching';
  }

  return 'open';
}

/**
 * Format deadline date for display
 *
 * @param deadlineDate - YYYY-MM-DD format
 * @returns Formatted date string (e.g., "30 Apr 2026")
 */
export function formatDeadlineDate(deadlineDate: string): string {
  const date = new Date(deadlineDate);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format days until deadline for display
 *
 * @param days - Number of days (negative if overdue)
 * @returns Formatted string (e.g., "93 days", "Overdue by 5 days")
 */
export function formatDaysUntilDeadline(days: number): string {
  if (days < 0) {
    return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days === 1) {
    return '1 day remaining';
  }

  return `${days} days remaining`;
}

/**
 * Get reminder schedule dates for a deadline
 *
 * @param deadlineDate - YYYY-MM-DD format
 * @returns Object with reminder dates
 */
export function getReminderSchedule(deadlineDate: string): Record<RndReminderType, string> {
  const deadline = new Date(deadlineDate);

  return {
    '90_days': new Date(deadline.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    '60_days': new Date(deadline.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    '30_days': new Date(deadline.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    '7_days': new Date(deadline.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };
}

export default RND_STATUS_CONFIG;
