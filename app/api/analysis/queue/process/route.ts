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
import { processAnalysisQueue } from '@/lib/analysis/reanalysis-worker';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:analysis:queue:process');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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
