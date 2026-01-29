/**
 * Storage Cleanup Utility
 *
 * Automated cleanup of old files from Supabase Storage to manage costs and storage limits.
 *
 * Features:
 * - Remove reports older than X days (default: 90)
 * - Remove orphaned files (files without database records)
 * - Show storage usage before/after cleanup
 * - Dry-run mode for testing
 *
 * Usage:
 *   npx ts-node scripts/storage-cleanup.ts
 *   npx ts-node scripts/storage-cleanup.ts --days 60
 *   npx ts-node scripts/storage-cleanup.ts --dry-run
 *   npx ts-node scripts/storage-cleanup.ts --orphaned-only
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface CleanupStats {
  filesScanned: number;
  filesDeleted: number;
  bytesFreed: number;
  errors: number;
}

interface FileInfo {
  name: string;
  id: string;
  bucket_id: string;
  created_at: string;
  size: number;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const daysArg = args.find((arg) => arg.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90;
  const dryRun = args.includes('--dry-run');
  const orphanedOnly = args.includes('--orphaned-only');

  return { days, dryRun, orphanedOnly };
}

/**
 * Get storage usage for all buckets
 */
async function getStorageUsage(): Promise<Record<string, { files: number; bytes: number }>> {
  const buckets = ['reports', 'recommendation-documents'];
  const usage: Record<string, { files: number; bytes: number }> = {};

  for (const bucketId of buckets) {
    const { data: files, error } = await supabase.storage.from(bucketId).list('', {
      limit: 10000,
    });

    if (error) {
      console.error(`Error listing files in ${bucketId}:`, error.message);
      usage[bucketId] = { files: 0, bytes: 0 };
      continue;
    }

    const totalBytes = files?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;

    usage[bucketId] = {
      files: files?.length || 0,
      bytes: totalBytes,
    };
  }

  return usage;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Clean up old report files
 */
async function cleanupOldReports(
  daysOld: number,
  dryRun: boolean
): Promise<CleanupStats> {
  console.log(`\n🗑️  Cleaning up reports older than ${daysOld} days...`);

  const stats: CleanupStats = {
    filesScanned: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: 0,
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    // List all report files
    const { data: files, error: listError } = await supabase.storage
      .from('reports')
      .list('', {
        limit: 10000,
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (listError) {
      console.error('❌ Failed to list report files:', listError.message);
      stats.errors++;
      return stats;
    }

    if (!files || files.length === 0) {
      console.log('✅ No report files found');
      return stats;
    }

    stats.filesScanned = files.length;

    // Filter files older than cutoff date
    const oldFiles = files.filter((file) => {
      const fileDate = new Date(file.created_at);
      return fileDate < cutoffDate;
    });

    if (oldFiles.length === 0) {
      console.log('✅ No old files to delete');
      return stats;
    }

    console.log(`Found ${oldFiles.length} file(s) older than ${cutoffDate.toISOString()}`);

    // Calculate total size
    const totalSize = oldFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    stats.bytesFreed = totalSize;

    if (dryRun) {
      console.log(`\n🔍 DRY RUN: Would delete ${oldFiles.length} file(s) (${formatBytes(totalSize)})`);
      oldFiles.slice(0, 10).forEach((file) => {
        console.log(`   - ${file.name} (${formatBytes(file.metadata?.size || 0)})`);
      });
      if (oldFiles.length > 10) {
        console.log(`   ... and ${oldFiles.length - 10} more`);
      }
      return stats;
    }

    // Delete files
    const filePaths = oldFiles.map((file) => file.name);

    const { data, error: deleteError } = await supabase.storage
      .from('reports')
      .remove(filePaths);

    if (deleteError) {
      console.error('❌ Failed to delete files:', deleteError.message);
      stats.errors++;
      return stats;
    }

    stats.filesDeleted = filePaths.length;

    console.log(`✅ Deleted ${stats.filesDeleted} file(s) (${formatBytes(stats.bytesFreed)})`);

    // Clean up database records
    const { error: dbError } = await supabase
      .from('generated_reports')
      .delete()
      .lt('generated_at', cutoffDate.toISOString());

    if (dbError) {
      console.warn('⚠️  Failed to clean up database records:', dbError.message);
    } else {
      console.log('✅ Cleaned up database records');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    stats.errors++;
  }

  return stats;
}

/**
 * Find and remove orphaned files (files without database records)
 */
async function cleanupOrphanedFiles(dryRun: boolean): Promise<CleanupStats> {
  console.log('\n🗑️  Cleaning up orphaned files...');

  const stats: CleanupStats = {
    filesScanned: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: 0,
  };

  try {
    // Get all files from reports bucket
    const { data: files, error: listError } = await supabase.storage
      .from('reports')
      .list('reports/', {
        limit: 10000,
      });

    if (listError) {
      console.error('❌ Failed to list files:', listError.message);
      stats.errors++;
      return stats;
    }

    if (!files || files.length === 0) {
      console.log('✅ No files to check');
      return stats;
    }

    stats.filesScanned = files.length;

    // Get all report IDs from database
    const { data: dbReports, error: dbError } = await supabase
      .from('generated_reports')
      .select('report_id, pdf_path, excel_path');

    if (dbError) {
      console.error('❌ Failed to fetch database records:', dbError.message);
      stats.errors++;
      return stats;
    }

    const validReportIds = new Set(
      dbReports?.map((r) => r.report_id) || []
    );

    // Find orphaned files
    const orphanedFiles = files.filter((file) => {
      const reportId = file.name.replace(/\.(pdf|xlsx)$/, '');
      return !validReportIds.has(reportId);
    });

    if (orphanedFiles.length === 0) {
      console.log('✅ No orphaned files found');
      return stats;
    }

    console.log(`Found ${orphanedFiles.length} orphaned file(s)`);

    const totalSize = orphanedFiles.reduce(
      (sum, file) => sum + (file.metadata?.size || 0),
      0
    );
    stats.bytesFreed = totalSize;

    if (dryRun) {
      console.log(
        `\n🔍 DRY RUN: Would delete ${orphanedFiles.length} orphaned file(s) (${formatBytes(totalSize)})`
      );
      orphanedFiles.slice(0, 10).forEach((file) => {
        console.log(`   - ${file.name} (${formatBytes(file.metadata?.size || 0)})`);
      });
      if (orphanedFiles.length > 10) {
        console.log(`   ... and ${orphanedFiles.length - 10} more`);
      }
      return stats;
    }

    // Delete orphaned files
    const filePaths = orphanedFiles.map((file) => `reports/${file.name}`);

    const { error: deleteError } = await supabase.storage
      .from('reports')
      .remove(filePaths);

    if (deleteError) {
      console.error('❌ Failed to delete orphaned files:', deleteError.message);
      stats.errors++;
      return stats;
    }

    stats.filesDeleted = filePaths.length;

    console.log(`✅ Deleted ${stats.filesDeleted} orphaned file(s) (${formatBytes(stats.bytesFreed)})`);
  } catch (error) {
    console.error('❌ Error cleaning orphaned files:', error);
    stats.errors++;
  }

  return stats;
}

/**
 * Main function
 */
async function main() {
  console.log('🧹 Storage Cleanup Utility');
  console.log('=========================\n');

  const { days, dryRun, orphanedOnly } = parseArgs();

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be deleted\n');
  }

  // Show storage usage before cleanup
  console.log('📊 Storage Usage (Before):');
  const usageBefore = await getStorageUsage();
  for (const [bucket, stats] of Object.entries(usageBefore)) {
    console.log(`   ${bucket}: ${stats.files} files, ${formatBytes(stats.bytes)}`);
  }

  let totalStats: CleanupStats = {
    filesScanned: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: 0,
  };

  // Run cleanup operations
  if (!orphanedOnly) {
    const oldReportsStats = await cleanupOldReports(days, dryRun);
    totalStats.filesScanned += oldReportsStats.filesScanned;
    totalStats.filesDeleted += oldReportsStats.filesDeleted;
    totalStats.bytesFreed += oldReportsStats.bytesFreed;
    totalStats.errors += oldReportsStats.errors;
  }

  const orphanedStats = await cleanupOrphanedFiles(dryRun);
  totalStats.filesScanned += orphanedStats.filesScanned;
  totalStats.filesDeleted += orphanedStats.filesDeleted;
  totalStats.bytesFreed += orphanedStats.bytesFreed;
  totalStats.errors += orphanedStats.errors;

  // Show storage usage after cleanup
  if (!dryRun) {
    console.log('\n📊 Storage Usage (After):');
    const usageAfter = await getStorageUsage();
    for (const [bucket, stats] of Object.entries(usageAfter)) {
      const before = usageBefore[bucket];
      const savedFiles = before.files - stats.files;
      const savedBytes = before.bytes - stats.bytes;
      console.log(
        `   ${bucket}: ${stats.files} files (-${savedFiles}), ${formatBytes(stats.bytes)} (-${formatBytes(savedBytes)})`
      );
    }
  }

  // Summary
  console.log('\n📈 Cleanup Summary:');
  console.log(`   Files Scanned: ${totalStats.filesScanned}`);
  console.log(`   Files Deleted: ${totalStats.filesDeleted}`);
  console.log(`   Space Freed: ${formatBytes(totalStats.bytesFreed)}`);
  console.log(`   Errors: ${totalStats.errors}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to perform actual cleanup');
  }

  if (totalStats.errors > 0) {
    console.error('\n❌ Cleanup completed with errors');
    process.exit(1);
  } else {
    console.log('\n✅ Cleanup completed successfully!');
  }
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
