/**
 * GET /api/analysis/queue/status
 *
 * View analysis queue status and statistics.
 *
 * Query Parameters:
 * - tenantId?: string (optional) - Filter by tenant
 * - status?: string (optional) - Filter by status (pending/processing/completed/failed)
 *
 * Returns:
 * - Queue statistics
 * - Recent jobs
 * - Performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    const supabase = await createServiceClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return createErrorResponse(
        new Error('Unauthorized'),
        { operation: 'getQueueStatus' },
        401
      );
    }

    // Build query
    let query = supabase.from('analysis_queue').select('*');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Order by creation time (most recent first)
    query = query.order('created_at', { ascending: false }).limit(100);

    const { data: jobs, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_jobs: jobs?.length || 0,
      pending: jobs?.filter((j) => j.status === 'pending').length || 0,
      processing: jobs?.filter((j) => j.status === 'processing').length || 0,
      completed: jobs?.filter((j) => j.status === 'completed').length || 0,
      failed: jobs?.filter((j) => j.status === 'failed').length || 0,
      cancelled: jobs?.filter((j) => j.status === 'cancelled').length || 0,
    };

    // Calculate priority breakdown
    const byPriority = {
      critical: jobs?.filter((j) => j.priority === 'critical' && j.status === 'pending').length || 0,
      high: jobs?.filter((j) => j.priority === 'high' && j.status === 'pending').length || 0,
      medium: jobs?.filter((j) => j.priority === 'medium' && j.status === 'pending').length || 0,
      low: jobs?.filter((j) => j.priority === 'low' && j.status === 'pending').length || 0,
    };

    // Calculate average processing time for completed jobs
    const completedJobs = jobs?.filter((j) => j.status === 'completed' && j.started_at && j.completed_at) || [];
    let avgProcessingTimeSeconds = 0;

    if (completedJobs.length > 0) {
      const totalProcessingTimeMs = completedJobs.reduce((sum, job) => {
        const startTime = new Date(job.started_at!).getTime();
        const endTime = new Date(job.completed_at!).getTime();
        return sum + (endTime - startTime);
      }, 0);

      avgProcessingTimeSeconds = Math.round(totalProcessingTimeMs / completedJobs.length / 1000);
    }

    // Get oldest pending job
    const oldestPending = jobs?.find((j) => j.status === 'pending');
    let oldestPendingAge = 0;

    if (oldestPending) {
      const createdTime = new Date(oldestPending.created_at).getTime();
      const now = Date.now();
      oldestPendingAge = Math.round((now - createdTime) / 1000 / 60); // minutes
    }

    // Summary of improvements (from completed jobs with improvement_summary)
    const jobsWithImprovements = jobs?.filter(
      (j) => j.status === 'completed' && j.improvement_summary
    ) || [];

    const totalImprovements = jobsWithImprovements.reduce(
      (sum, job) => {
        const summary = job.improvement_summary;
        return {
          confidence_improved: sum.confidence_improved + (summary.data_quality_improved ? 1 : 0),
          total_additional_benefit:
            sum.total_additional_benefit + (summary.additional_benefit || 0),
          total_new_findings: sum.total_new_findings + (summary.new_findings_count || 0),
        };
      },
      { confidence_improved: 0, total_additional_benefit: 0, total_new_findings: 0 }
    );

    return NextResponse.json({
      success: true,
      queue_stats: stats,
      pending_by_priority: byPriority,
      performance_metrics: {
        avg_processing_time_seconds: avgProcessingTimeSeconds,
        oldest_pending_job_age_minutes: oldestPendingAge,
        completed_jobs_count: completedJobs.length,
      },
      improvement_summary: {
        jobs_with_improvements: jobsWithImprovements.length,
        confidence_improved_count: totalImprovements.confidence_improved,
        total_additional_benefit: totalImprovements.total_additional_benefit,
        total_new_findings: totalImprovements.total_new_findings,
      },
      recent_jobs: jobs?.slice(0, 20).map((j) => ({
        id: j.id,
        tenant_id: j.tenant_id,
        analysis_type: j.analysis_type,
        priority: j.priority,
        status: j.status,
        created_at: j.created_at,
        started_at: j.started_at,
        completed_at: j.completed_at,
        improvement_summary: j.improvement_summary,
        error_message: j.error_message,
      })),
      metadata: {
        retrievedAt: new Date().toISOString(),
        tenantIdFilter: tenantId || 'none',
        statusFilter: status || 'all',
      },
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);

    return createErrorResponse(
      error,
      {
        operation: 'getQueueStatus',
        endpoint: '/api/analysis/queue/status',
      },
      500
    );
  }
}
