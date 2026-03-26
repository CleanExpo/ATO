/**
 * POST /api/analysis/queue/process
 *
 * Process pending analysis queue jobs (re-analysis after questionnaire completion).
 * Can be called manually or by scheduled cron job.
 *
 * Body:
 * - maxJobs?: number (optional, default: 10) - Maximum jobs to process in one run
 *
 * Returns:
 * - Processing statistics
 * - Success/failure counts
 * - Error details
 */

import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createValidationError } from '@/lib/api/errors';
import { requireAuth, isErrorResponse } from '@/lib/auth/require-auth';
import { processAnalysisQueue } from '@/lib/analysis/reanalysis-worker';
import { distributedRateLimit, createDistributedRateLimitResponse } from '@/lib/middleware/distributed-rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:analysis:queue:process');

/** Per-user concurrency cap for analysis queue processing — prevents a single user overwhelming the Gemini API */
const ANALYSIS_CONCURRENCY_LIMIT = 2;
const ANALYSIS_CONCURRENCY_WINDOW_SECONDS = 300; // 5-minute window

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.clone() as NextRequest, { skipTenantValidation: true });
    if (isErrorResponse(auth)) return auth;

    // Per-user concurrency guard — cap concurrent analysis runs per user
    const userId = auth.user.id;
    const concurrencyCheck = await distributedRateLimit({
      identifier: `analysis-queue:${userId}`,
      limit: ANALYSIS_CONCURRENCY_LIMIT,
      windowSeconds: ANALYSIS_CONCURRENCY_WINDOW_SECONDS,
    });

    if (!concurrencyCheck.success) {
      log.warn('Analysis concurrency limit exceeded', {
        userId,
        limit: ANALYSIS_CONCURRENCY_LIMIT,
        windowSeconds: ANALYSIS_CONCURRENCY_WINDOW_SECONDS,
      });
      return createDistributedRateLimitResponse(concurrencyCheck);
    }

    const body = await request.json().catch(() => ({}));
    const { maxJobs = 10 } = body;

    // Validate maxJobs
    if (typeof maxJobs !== 'number' || maxJobs < 1 || maxJobs > 100) {
      return createValidationError('maxJobs must be a number between 1 and 100');
    }

    log.info('Starting analysis queue processing', { maxJobs });

    // Process queue
    const result = await processAnalysisQueue(maxJobs);

    return NextResponse.json({
      success: true,
      processing_stats: {
        jobs_processed: result.processed,
        jobs_failed: result.failed,
        total_jobs: result.processed + result.failed,
        error_count: result.errors.length,
      },
      errors: result.errors,
      metadata: {
        processedAt: new Date().toISOString(),
        maxJobsRequested: maxJobs,
      },
      message:
        result.processed > 0
          ? `Successfully processed ${result.processed} analysis job(s)`
          : 'No pending jobs in queue',
    });
  } catch (error) {
    console.error('Error processing analysis queue:', error);

    return createErrorResponse(
      error,
      {
        operation: 'processAnalysisQueue',
        endpoint: '/api/analysis/queue/process',
      },
      500
    );
  }
}
