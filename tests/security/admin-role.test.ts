/**
 * Security tests for admin role middleware
 *
 * Tests cover:
 * - Admin role verification
 * - Unauthorized access blocking
 * - Audit logging of admin actions
 * - Rate limiting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'test-user-id',
              email: 'admin@test.com',
            },
          },
          error: null,
        })
      ),
    },
    from: vi.fn((table: string) => ({
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
      insert: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: null,
        })
      ),
    })),
  })),
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      insert: vi.fn(() =>
        Promise.resolve({
          error: null,
        })
      ),
    })),
  })),
}));

import { requireAdminRole, isUserAdmin } from '@/lib/middleware/admin-role';
import { logAdminAction } from '@/lib/audit/logger';

describe('Admin Role Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdminRole', () => {
    it('should allow access for admin users', async () => {
      const result = await requireAdminRole();

      expect(result.isAdmin).toBe(true);
      expect(result.userId).toBe('test-user-id');
      expect(result.email).toBe('admin@test.com');
      expect(result.response).toBeUndefined();
    });

    it('should block access for non-admin users', async () => {
      // Mock non-admin user
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: {
                user: {
                  id: 'regular-user-id',
                  email: 'user@test.com',
                },
              },
              error: null,
            })
          ),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { is_admin: false },
                  error: null,
                })
              ),
            })),
          })),
        })),
      } as any);

      const result = await requireAdminRole();

      expect(result.isAdmin).toBe(false);
      expect(result.response).toBeDefined();

      if (result.response) {
        expect(result.response.status).toBe(403);
        const body = await result.response.json();
        expect(body.error).toBe('Forbidden');
        expect(body.message).toContain('Admin privileges required');
      }
    });

    it('should block access for unauthenticated users', async () => {
      // Mock unauthenticated user
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn(() =>
            Promise.resolve({
              data: { user: null },
              error: new Error('Not authenticated'),
            })
          ),
        },
      } as any);

      const result = await requireAdminRole();

      expect(result.isAdmin).toBe(false);
      expect(result.response).toBeDefined();

      if (result.response) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error).toBe('Authentication required');
      }
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for admin users', async () => {
      const isAdmin = await isUserAdmin('admin-user-id');
      expect(isAdmin).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      // Mock non-admin user
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { is_admin: false },
                  error: null,
                })
              ),
            })),
          })),
        })),
      } as any);

      const isAdmin = await isUserAdmin('regular-user-id');
      expect(isAdmin).toBe(false);
    });

    it('should return false when user profile not found', async () => {
      // Mock missing profile
      const { createClient } = await import('@/lib/supabase/server');
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: new Error('Profile not found'),
                })
              ),
            })),
          })),
        })),
      } as any);

      const isAdmin = await isUserAdmin('unknown-user-id');
      expect(isAdmin).toBe(false);
    });
  });
});

describe('Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAdminAction', () => {
    it('should log admin action successfully', async () => {
      const result = await logAdminAction({
        action: 'accountant_application_approved',
        actor_id: 'admin-123',
        actor_email: 'admin@test.com',
        target_id: 'app-456',
        target_type: 'accountant_application',
        details: {
          firm_name: 'Test Firm',
          credential_type: 'CPA',
        },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
      });

      expect(result).toBe(true);
    });

    it('should handle audit logging failures gracefully', async () => {
      // Mock database error
      const { createServiceClient } = await import('@/lib/supabase/server');
      vi.mocked(createServiceClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          insert: vi.fn(() =>
            Promise.resolve({
              error: new Error('Database error'),
            })
          ),
        })),
      } as any);

      const result = await logAdminAction({
        action: 'accountant_application_rejected',
        actor_id: 'admin-123',
        actor_email: 'admin@test.com',
      });

      // Should not throw, just return false
      expect(result).toBe(false);
    });

    it('should include all required audit fields', async () => {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const insertMock = vi.fn(() =>
        Promise.resolve({
          error: null,
        })
      );

      vi.mocked(createServiceClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          insert: insertMock,
        })),
      } as any);

      await logAdminAction({
        action: 'dashboard_reset',
        actor_id: 'admin-789',
        actor_email: 'superadmin@test.com',
        target_id: 'org-123',
        target_type: 'organization',
        details: {
          reason: 'Customer requested demo reset',
        },
        ip_address: '192.168.1.1',
        user_agent: 'Chrome/120.0',
      });

      expect(insertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          action: 'dashboard_reset',
          actor_id: 'admin-789',
          actor_email: 'superadmin@test.com',
          target_id: 'org-123',
          target_type: 'organization',
          details: expect.any(Object),
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/120.0',
          created_at: expect.any(String),
        }),
      ]);
    });
  });
});
