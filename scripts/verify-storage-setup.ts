/**
 * Storage Setup Verification Script
 *
 * Verifies that Supabase Storage buckets are properly configured and accessible.
 * Can also be used to test storage operations.
 *
 * Usage:
 *   npx ts-node scripts/verify-storage-setup.ts
 *   npx ts-node scripts/verify-storage-setup.ts --test-upload
 *   npx ts-node scripts/verify-storage-setup.ts --cleanup
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REQUIRED_BUCKETS = [
  {
    id: 'reports',
    name: 'reports',
    public: false,
    fileSizeLimit: 52428800, // 50 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
  },
  {
    id: 'recommendation-documents',
    name: 'recommendation-documents',
    public: false,
    fileSizeLimit: 10485760, // 10 MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
  },
];

interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number;
  allowed_mime_types: string[];
  created_at: string;
  updated_at: string;
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Check if environment variables are configured
 */
function checkEnvironment(): boolean {
  console.log('\n=== Environment Check ===');

  if (!SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    return false;
  }
  console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    return false;
  }
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY: ********' + SUPABASE_SERVICE_ROLE_KEY.slice(-8));

  return true;
}

/**
 * Verify that all required storage buckets exist
 */
async function verifyBuckets(): Promise<boolean> {
  console.log('\n=== Storage Buckets Verification ===');

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Failed to list buckets:', error.message);
      return false;
    }

    if (!buckets || buckets.length === 0) {
      console.error('❌ No storage buckets found');
      return false;
    }

    console.log(`\nFound ${buckets.length} bucket(s):`);

    let allRequiredExist = true;

    for (const required of REQUIRED_BUCKETS) {
      const bucket = buckets.find((b) => b.id === required.id) as BucketInfo | undefined;

      if (!bucket) {
        console.error(`\n❌ Required bucket '${required.id}' not found`);
        allRequiredExist = false;
        continue;
      }

      console.log(`\n✅ Bucket: ${bucket.id}`);
      console.log(`   Name: ${bucket.name}`);
      console.log(`   Public: ${bucket.public}`);
      console.log(
        `   File Size Limit: ${(bucket.file_size_limit / 1048576).toFixed(2)} MB`
      );
      console.log(`   Allowed MIME Types: ${bucket.allowed_mime_types?.length || 0} types`);
      console.log(`   Created: ${bucket.created_at}`);

      // Verify configuration matches requirements
      if (bucket.public !== required.public) {
        console.warn(
          `   ⚠️  Public setting mismatch: expected ${required.public}, got ${bucket.public}`
        );
      }

      if (bucket.file_size_limit !== required.fileSizeLimit) {
        console.warn(
          `   ⚠️  File size limit mismatch: expected ${required.fileSizeLimit}, got ${bucket.file_size_limit}`
        );
      }
    }

    return allRequiredExist;
  } catch (error) {
    console.error('❌ Error verifying buckets:', error);
    return false;
  }
}

/**
 * Test file upload and download operations
 */
async function testUploadDownload(): Promise<boolean> {
  console.log('\n=== Storage Upload/Download Test ===');

  try {
    // Create a test file
    const testContent = 'Test file content - ' + new Date().toISOString();
    const testFileName = `test-${Date.now()}.txt`;
    const testPath = `test/${testFileName}`;

    console.log(`\n📤 Uploading test file: ${testPath}`);

    // Upload to reports bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(testPath, Buffer.from(testContent), {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      return false;
    }

    console.log('✅ Upload successful');
    console.log(`   Path: ${uploadData.path}`);

    // Download the file
    console.log(`\n📥 Downloading test file: ${testPath}`);

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(testPath);

    if (downloadError) {
      console.error('❌ Download failed:', downloadError.message);
      return false;
    }

    const downloadedContent = await downloadData.text();

    if (downloadedContent !== testContent) {
      console.error('❌ Downloaded content does not match uploaded content');
      return false;
    }

    console.log('✅ Download successful');
    console.log(`   Content verified: ${downloadedContent.substring(0, 50)}...`);

    // Clean up test file
    console.log(`\n🗑️  Cleaning up test file: ${testPath}`);

    const { error: deleteError } = await supabase.storage
      .from('reports')
      .remove([testPath]);

    if (deleteError) {
      console.warn('⚠️  Failed to delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file deleted');
    }

    return true;
  } catch (error) {
    console.error('❌ Error during upload/download test:', error);
    return false;
  }
}

/**
 * Get storage usage statistics
 */
async function getStorageStats(): Promise<void> {
  console.log('\n=== Storage Statistics ===');

  try {
    for (const bucket of REQUIRED_BUCKETS) {
      console.log(`\n📊 Bucket: ${bucket.id}`);

      const { data: files, error } = await supabase.storage.from(bucket.id).list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) {
        console.error(`   ❌ Failed to list files: ${error.message}`);
        continue;
      }

      if (!files || files.length === 0) {
        console.log('   📁 No files in bucket');
        continue;
      }

      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      const totalSizeMB = (totalSize / 1048576).toFixed(2);

      console.log(`   📁 Files: ${files.length}`);
      console.log(`   💾 Total Size: ${totalSizeMB} MB`);
      console.log(`   📅 Oldest File: ${files[files.length - 1]?.created_at || 'N/A'}`);
      console.log(`   📅 Newest File: ${files[0]?.created_at || 'N/A'}`);
    }
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
  }
}

/**
 * Clean up old test files
 */
async function cleanupTestFiles(): Promise<void> {
  console.log('\n=== Cleanup Test Files ===');

  try {
    const { data: files, error: listError } = await supabase.storage
      .from('reports')
      .list('test/', {
        limit: 1000,
      });

    if (listError) {
      console.error('❌ Failed to list test files:', listError.message);
      return;
    }

    if (!files || files.length === 0) {
      console.log('✅ No test files to clean up');
      return;
    }

    console.log(`Found ${files.length} test file(s) to delete`);

    const filePaths = files.map((file) => `test/${file.name}`);

    const { data, error: deleteError } = await supabase.storage
      .from('reports')
      .remove(filePaths);

    if (deleteError) {
      console.error('❌ Failed to delete test files:', deleteError.message);
      return;
    }

    console.log(`✅ Deleted ${filePaths.length} test file(s)`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('🔍 Supabase Storage Verification Tool');
  console.log('=====================================');

  const args = process.argv.slice(2);
  const testUpload = args.includes('--test-upload');
  const cleanup = args.includes('--cleanup');
  const stats = args.includes('--stats');

  // Check environment
  if (!checkEnvironment()) {
    console.error('\n❌ Environment check failed. Please configure environment variables.');
    process.exit(1);
  }

  // Verify buckets
  const bucketsOk = await verifyBuckets();

  if (!bucketsOk) {
    console.error(
      '\n❌ Bucket verification failed. Run the migration: supabase/migrations/007_create_storage_buckets.sql'
    );
    process.exit(1);
  }

  // Test upload/download if requested
  if (testUpload) {
    const uploadOk = await testUploadDownload();
    if (!uploadOk) {
      console.error('\n❌ Upload/download test failed');
      process.exit(1);
    }
  }

  // Show storage stats if requested
  if (stats) {
    await getStorageStats();
  }

  // Cleanup test files if requested
  if (cleanup) {
    await cleanupTestFiles();
  }

  console.log('\n✅ Storage verification complete!');
  console.log('\nUsage examples:');
  console.log('  npx ts-node scripts/verify-storage-setup.ts --test-upload');
  console.log('  npx ts-node scripts/verify-storage-setup.ts --stats');
  console.log('  npx ts-node scripts/verify-storage-setup.ts --cleanup');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
