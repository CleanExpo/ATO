/**
 * API Integration tests for accountant application approval and rejection
 *
 * Tests cover:
 * - Application approval flow with email notifications
 * - Application rejection flow with email notifications
 * - Validation of request parameters
 * - Error handling for invalid applications
 * - Email sending success and failure scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'app-123',
                email: 'accountant@firm.com.au',
                first_name: 'John',
                last_name: 'Smith',
                firm_name: 'Smith & Associates',
                firm_abn: '12345678901',
                credential_type: 'CPA',
                credential_number: 'CPA-12345',
                status: 'pending',
              },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: 'vetted-123' },
              error: null,
            })
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'admin-user-id', email: 'admin@test.com' } },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: { is_admin: true },
              error: null,
            })
          ),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

vi.mock('@/lib/audit/logger', () => ({
  logAdminAction: vi.fn(() => Promise.resolve()),
  getIpAddress: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test-agent'),
}));

vi.mock('@/lib/email/resend-client', () => ({
  sendAccountantWelcomeEmail: vi.fn(() =>
    Promise.resolve({
      success: true,
      messageId: 'welcome-email-123',
    })
  ),
  sendAccountantRejectionEmail: vi.fn(() =>
    Promise.resolve({
      success: true,
      messageId: 'rejection-email-123',
    })
  ),
}));

import { PATCH as approveHandler } from '@/app/api/admin/accountant-applications/[id]/approve/route';
import { PATCH as rejectHandler } from '@/app/api/admin/accountant-applications/[id]/reject/route';
import {
  sendAccountantWelcomeEmail,
  sendAccountantRejectionEmail,
} from '@/lib/email/resend-client';

describe('Accountant Application API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/admin/accountant-applications/[id]/approve', () => {
    it('should approve application and send welcome email', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.15,
            send_welcome_email: true,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.accountant_id).toBeDefined();
      expect(sendAccountantWelcomeEmail).toHaveBeenCalledWith({
        to: 'accountant@firm.com.au',
        firstName: 'John',
        lastName: 'Smith',
        firmName: 'Smith & Associates',
        pricingTier: 'standard',
        loginUrl: expect.stringContaining('/auth/login'),
      });
    });

    it('should approve with professional tier (25% discount)', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.25,
            send_welcome_email: true,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      await response!.json();

      expect(sendAccountantWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          pricingTier: 'professional',
        })
      );
    });

    it('should approve with enterprise tier (35% discount)', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.35,
            send_welcome_email: true,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      await response!.json();

      expect(sendAccountantWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          pricingTier: 'enterprise',
        })
      );
    });

    it('should approve without sending email when send_welcome_email is false', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.15,
            send_welcome_email: false,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      const data = await response!.json();

      expect(data.success).toBe(true);
      expect(sendAccountantWelcomeEmail).not.toHaveBeenCalled();
      expect(data.message).toContain('No email sent');
    });

    it('should continue approval even if email sending fails', async () => {
      // Mock email failure
      vi.mocked(sendAccountantWelcomeEmail).mockResolvedValueOnce({
        success: false,
        error: 'SMTP connection failed',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.15,
            send_welcome_email: true,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      const data = await response!.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('Warning');
      expect(data.message).toContain('Failed to send welcome email');
    });

    it('should reject invalid UUID format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/invalid-id/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 0.15,
          }),
        }
      );

      const params = Promise.resolve({ id: 'invalid-id' });

      const response = await approveHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain('Invalid application ID format');
      expect(data.errorId).toBeDefined();
    });

    it('should reject invalid wholesale discount rate', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/approve',
        {
          method: 'PATCH',
          body: JSON.stringify({
            wholesale_discount_rate: 1.5, // Invalid: > 1
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await approveHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain('wholesale_discount_rate must be between 0 and 1');
      expect(data.errorId).toBeDefined();
    });
  });

  describe('PATCH /api/admin/accountant-applications/[id]/reject', () => {
    it('should reject application and send rejection email', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason:
              'Insufficient documentation provided for credential verification.',
            can_reapply: true,
            reapply_after_days: 90,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.can_reapply).toBe(true);
      expect(sendAccountantRejectionEmail).toHaveBeenCalledWith({
        to: 'accountant@firm.com.au',
        firstName: 'John',
        rejectionReason:
          'Insufficient documentation provided for credential verification.',
      });
    });

    it('should reject application without specific reason in email', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason:
              'Application did not meet our current requirements.',
            can_reapply: false,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(data.success).toBe(true);
      expect(data.can_reapply).toBe(false);
      expect(sendAccountantRejectionEmail).toHaveBeenCalled();
    });

    it('should continue rejection even if email sending fails', async () => {
      // Mock email failure
      vi.mocked(sendAccountantRejectionEmail).mockResolvedValueOnce({
        success: false,
        error: 'Email service unavailable',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason: 'Test rejection reason for failure case.',
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('Warning');
      expect(data.message).toContain('Failed to send rejection email');
    });

    it('should reject invalid UUID format', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/invalid/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason: 'Test rejection',
          }),
        }
      );

      const params = Promise.resolve({ id: 'invalid' });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain('Invalid application ID format');
      expect(data.errorId).toBeDefined();
    });

    it('should validate rejection reason length', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason: 'Too short', // Less than 10 characters
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain('rejection_reason must be at least 10 characters');
      expect(data.errorId).toBeDefined();
    });

    it('should require rejection reason', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({}),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(response!.status).toBe(400);
      expect(data.error).toContain('rejection_reason is required');
      expect(data.errorId).toBeDefined();
    });

    it('should calculate correct reapply date', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/accountant-applications/123/reject',
        {
          method: 'PATCH',
          body: JSON.stringify({
            rejection_reason: 'Test rejection with custom reapply period.',
            can_reapply: true,
            reapply_after_days: 30,
          }),
        }
      );

      const params = Promise.resolve({
        id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await rejectHandler(request, { params });
      const data = await response!.json();

      expect(data.success).toBe(true);
      expect(data.reapply_after).toBeDefined();

      // Verify the date is approximately 30 days in the future
      const reapplyDate = new Date(data.reapply_after as string);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);

      const timeDiff = Math.abs(reapplyDate.getTime() - expectedDate.getTime());
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeLessThan(1); // Within 1 day tolerance
    });
  });
});
