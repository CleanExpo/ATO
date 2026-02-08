/**
 * Work Queue Manager
 *
 * Manages the idea intake work queue with operations for:
 * - Adding queue items (capture)
 * - Fetching next items for processing
 * - Updating queue status and metadata
 * - Archiving completed items
 *
 * Pattern: Follows lib/ai/batch-processor.ts pattern for batch operations
 * Database: Supabase work_queue table
 */

import { createServiceClient } from '@/lib/supabase/server';

// =====================================================
// TypeScript Interfaces
// =====================================================

export type QueueStatus =
  | 'pending'      // Initial capture, awaiting PM validation
  | 'validating'   // Senior PM is validating
  | 'validated'    // Passed validation, ready for execution
  | 'processing'   // Currently being executed by work loop
  | 'complete'     // Successfully executed
  | 'failed'       // Execution failed
  | 'archived';    // Completed and archived

export type QueueItemType =
  | 'feature'         // New feature request
  | 'bug'             // Bug report or issue
  | 'improvement'     // Enhancement to existing feature
  | 'client_request'  // Request from client/stakeholder
  | 'task';           // General task

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Complexity = 'simple' | 'medium' | 'complex';

export interface QueueItem {
  id: string;
  created_at: string;
  updated_at: string;
  status: QueueStatus;
  queue_item_type: QueueItemType;
  title: string;
  description: string;
  payload: Record<string, unknown>; // Full user context (JSON)
  validation_result?: ValidationResult;
  complexity?: Complexity;
  priority?: Priority;
  assigned_agent?: string;
  linear_issue_id?: string;
  linear_issue_identifier?: string;
  linear_issue_url?: string;
  processed_at?: string;
  archived_at?: string;
  error_message?: string;
  error_count: number;
  screenshots?: string[];
  execution_log?: string;
  token_usage?: number;
  execution_time_seconds?: number;
}

export interface ValidationResult {
  feasible: boolean;
  feasibility_score: number; // 0-100
  complexity: Complexity;
  is_duplicate: boolean;
  duplicate_issue_id?: string;
  priority: Priority;
  assigned_agent: string;
  execution_strategy: 'direct' | 'requires_planning' | 'specialist_review';
  confidence: number; // 0-100
  notes?: string;
}

export interface QueueStatistics {
  total_items: number;
  pending_count: number;
  validating_count: number;
  validated_count: number;
  processing_count: number;
  complete_count: number;
  failed_count: number;
  archived_count: number;
  avg_execution_time_seconds: number | null;
  total_token_usage: number | null;
}

// =====================================================
// Queue Operations
// =====================================================

/**
 * Add a new item to the work queue
 *
 * Called by capture skill to queue ideas instantly
 *
 * @param item - Partial queue item (title, description, type, payload)
 * @returns Created queue item with ID
 */
export async function addToQueue(
  item: {
    title: string;
    description: string;
    queue_item_type: QueueItemType;
    payload?: Record<string, unknown>;
  }
): Promise<QueueItem> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('work_queue')
    .insert({
      title: item.title.substring(0, 200), // Enforce max length
      description: item.description,
      queue_item_type: item.queue_item_type,
      payload: item.payload || {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add item to queue:', error);
    throw new Error(`Failed to add item to queue: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned after inserting queue item');
  }

  return data as QueueItem;
}

/**
 * Get next pending item for validation
 *
 * Called by Senior PM agent to pick up items for validation
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
 *
 * @returns Next pending queue item or null if queue is empty
 */
export async function getNextPendingItem(): Promise<QueueItem | null> {
  const supabase = await createServiceClient();

  // Call database function that uses FOR UPDATE SKIP LOCKED
  const { data: idData, error: idError } = await supabase
    .rpc('get_next_pending_queue_item');

  if (idError) {
    console.error('Failed to get next pending item:', idError);
    throw new Error(`Failed to get next pending item: ${idError.message}`);
  }

  if (!idData) {
    return null; // Queue is empty
  }

  // Fetch the full item
  const { data, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('id', idData)
    .single();

  if (error) {
    console.error('Failed to fetch queue item:', error);
    throw new Error(`Failed to fetch queue item: ${error.message}`);
  }

  return data as QueueItem;
}

/**
 * Get next validated item for execution
 *
 * Called by work loop processor to pick up validated items
 * Sorted by priority (P0 first) then creation time
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
 *
 * @returns Next validated queue item or null if queue is empty
 */
export async function getNextValidatedItem(): Promise<QueueItem | null> {
  const supabase = await createServiceClient();

  // Call database function that uses FOR UPDATE SKIP LOCKED
  const { data: idData, error: idError } = await supabase
    .rpc('get_next_validated_queue_item');

  if (idError) {
    console.error('Failed to get next validated item:', idError);
    throw new Error(`Failed to get next validated item: ${idError.message}`);
  }

  if (!idData) {
    return null; // Queue is empty
  }

  // Fetch the full item
  const { data, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('id', idData)
    .single();

  if (error) {
    console.error('Failed to fetch queue item:', error);
    throw new Error(`Failed to fetch queue item: ${error.message}`);
  }

  return data as QueueItem;
}

/**
 * Update queue item
 *
 * Generic update function for status changes, metadata, etc.
 *
 * @param id - Queue item ID
 * @param updates - Partial updates to apply
 */
export async function updateQueueItem(
  id: string,
  updates: Partial<QueueItem>
): Promise<QueueItem> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('work_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Failed to update queue item ${id}:`, error);
    throw new Error(`Failed to update queue item: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned after updating queue item');
  }

  return data as QueueItem;
}

/**
 * Mark item as validating
 *
 * Called when Senior PM starts validation
 *
 * @param id - Queue item ID
 */
export async function markAsValidating(id: string): Promise<QueueItem> {
  return updateQueueItem(id, { status: 'validating' });
}

/**
 * Mark item as validated
 *
 * Called after Senior PM completes validation
 *
 * @param id - Queue item ID
 * @param validationResult - PM validation output
 */
export async function markAsValidated(
  id: string,
  validationResult: ValidationResult
): Promise<QueueItem> {
  return updateQueueItem(id, {
    status: 'validated',
    validation_result: validationResult,
    complexity: validationResult.complexity,
    priority: validationResult.priority,
    assigned_agent: validationResult.assigned_agent,
  });
}

/**
 * Mark item as processing
 *
 * Called when work loop starts execution
 *
 * @param id - Queue item ID
 */
export async function markAsProcessing(id: string): Promise<QueueItem> {
  return updateQueueItem(id, { status: 'processing' });
}

/**
 * Mark item as complete
 *
 * Called after successful execution
 *
 * @param id - Queue item ID
 * @param metadata - Execution metadata (screenshots, logs, token usage, etc.)
 */
export async function markAsComplete(
  id: string,
  metadata: {
    screenshots?: string[];
    execution_log?: string;
    token_usage?: number;
    execution_time_seconds?: number;
  }
): Promise<QueueItem> {
  return updateQueueItem(id, {
    status: 'complete',
    processed_at: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Mark item as failed
 *
 * Called when execution fails
 *
 * @param id - Queue item ID
 * @param errorMessage - Error details
 */
export async function markAsFailed(
  id: string,
  errorMessage: string
): Promise<QueueItem> {
  const supabase = await createServiceClient();

  // Increment error count
  const { data: currentItem } = await supabase
    .from('work_queue')
    .select('error_count')
    .eq('id', id)
    .single();

  const newErrorCount = (currentItem?.error_count || 0) + 1;

  return updateQueueItem(id, {
    status: 'failed',
    error_message: errorMessage,
    error_count: newErrorCount,
    processed_at: new Date().toISOString(),
  });
}

/**
 * Archive queue item
 *
 * Final step after completion or abandonment
 *
 * @param id - Queue item ID
 */
export async function archiveQueueItem(id: string): Promise<QueueItem> {
  return updateQueueItem(id, {
    status: 'archived',
    archived_at: new Date().toISOString(),
  });
}

/**
 * Update Linear metadata after issue creation
 *
 * @param id - Queue item ID
 * @param linearData - Linear issue data
 */
export async function updateLinearMetadata(
  id: string,
  linearData: {
    issue_id: string;
    issue_identifier: string;
    issue_url: string;
  }
): Promise<QueueItem> {
  return updateQueueItem(id, {
    linear_issue_id: linearData.issue_id,
    linear_issue_identifier: linearData.issue_identifier,
    linear_issue_url: linearData.issue_url,
  });
}

// =====================================================
// Query Operations
// =====================================================

/**
 * Get queue item by ID
 *
 * @param id - Queue item ID
 * @returns Queue item or null if not found
 */
export async function getQueueItem(id: string): Promise<QueueItem | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Item not found
    }
    console.error(`Failed to get queue item ${id}:`, error);
    throw new Error(`Failed to get queue item: ${error.message}`);
  }

  return data as QueueItem;
}

/**
 * Get queue items by status
 *
 * @param status - Queue status to filter by
 * @param limit - Maximum number of items to return
 * @returns Array of queue items
 */
export async function getQueueItemsByStatus(
  status: QueueStatus,
  limit: number = 50
): Promise<QueueItem[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('work_queue')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`Failed to get queue items with status ${status}:`, error);
    throw new Error(`Failed to get queue items: ${error.message}`);
  }

  return (data || []) as QueueItem[];
}

/**
 * Get queue statistics
 *
 * Returns counts by status, average execution time, etc.
 *
 * @returns Queue statistics
 */
export async function getQueueStatistics(): Promise<QueueStatistics> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('get_queue_statistics');

  if (error) {
    console.error('Failed to get queue statistics:', error);
    throw new Error(`Failed to get queue statistics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Return empty statistics
    return {
      total_items: 0,
      pending_count: 0,
      validating_count: 0,
      validated_count: 0,
      processing_count: 0,
      complete_count: 0,
      failed_count: 0,
      archived_count: 0,
      avg_execution_time_seconds: null,
      total_token_usage: null,
    };
  }

  return data[0] as QueueStatistics;
}

/**
 * Search queue items by keyword
 *
 * Searches in title and description
 *
 * @param keyword - Search keyword
 * @param limit - Maximum number of items to return
 * @returns Array of matching queue items
 */
export async function searchQueueItems(
  keyword: string,
  limit: number = 20
): Promise<QueueItem[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('work_queue')
    .select('*')
    .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`Failed to search queue items for "${keyword}":`, error);
    throw new Error(`Failed to search queue items: ${error.message}`);
  }

  return (data || []) as QueueItem[];
}

/**
 * Get queue position for an item
 *
 * Returns position in queue based on status and priority
 *
 * @param id - Queue item ID
 * @returns Position (1-indexed) or null if not in queue
 */
export async function getQueuePosition(id: string): Promise<number | null> {
  const supabase = await createServiceClient();

  // Get the item
  const item = await getQueueItem(id);
  if (!item || item.status === 'archived') {
    return null; // Not in queue
  }

  // Count items ahead of this one
  const { count, error } = await supabase
    .from('work_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', item.status)
    .lt('created_at', item.created_at);

  if (error) {
    console.error(`Failed to get queue position for ${id}:`, error);
    return null;
  }

  return (count || 0) + 1;
}

// =====================================================
// Batch Operations
// =====================================================

/**
 * Clear failed items older than threshold
 *
 * Cleanup operation to archive old failed items
 *
 * @param daysOld - Archive items failed more than N days ago
 * @returns Number of items archived
 */
export async function archiveOldFailedItems(daysOld: number = 30): Promise<number> {
  const supabase = await createServiceClient();

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysOld);

  const { data, error } = await supabase
    .from('work_queue')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('status', 'failed')
    .lt('processed_at', thresholdDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to archive old failed items:', error);
    throw new Error(`Failed to archive old failed items: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Timeout stuck processing items
 *
 * Safety mechanism to mark items as failed if stuck in processing
 *
 * @param timeoutHours - Mark as failed if processing longer than N hours
 * @returns Number of items marked as failed
 */
export async function timeoutStuckItems(timeoutHours: number = 2): Promise<number> {
  const supabase = await createServiceClient();

  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - timeoutHours);

  const { data, error } = await supabase
    .from('work_queue')
    .update({
      status: 'failed',
      error_message: `Timeout: Processing exceeded ${timeoutHours} hours`,
      processed_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('updated_at', thresholdDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to timeout stuck items:', error);
    throw new Error(`Failed to timeout stuck items: ${error.message}`);
  }

  return data?.length || 0;
}
