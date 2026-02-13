# Storage Architecture Documentation

## Overview

The Australian Tax Optimizer uses Supabase Storage for secure, scalable file storage. This document describes the storage architecture, security model, and operational procedures.

## Storage Buckets

### 1. Reports Bucket

**Bucket ID:** `reports`

**Purpose:** Stores generated PDF and Excel forensic audit reports

**Configuration:**
- **Public:** `false` (requires authentication)
- **File Size Limit:** 50 MB per file
- **Allowed MIME Types:**
  - `application/pdf` (PDF reports)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (Excel reports)
  - `text/csv` (CSV exports)

**Path Structure:**
```
reports/
  └── {tenant_id}/
      ├── {report_id}.pdf
      └── {report_id}.xlsx
```

**Example:**
```
reports/tenant-abc-123/REP-1706400000000-abc12345.pdf
reports/tenant-abc-123/REP-1706400000000-abc12345.xlsx
```

**Database Tracking:**
- Metadata stored in `generated_reports` table
- Links report files to organizations and users
- Tracks download counts and timestamps

### 2. Recommendation Documents Bucket

**Bucket ID:** `recommendation-documents`

**Purpose:** Stores supporting documents attached to tax recommendations

**Configuration:**
- **Public:** `false` (requires authentication or valid share token)
- **File Size Limit:** 10 MB per file
- **Allowed MIME Types:**
  - `application/pdf`
  - `image/jpeg`, `image/jpg`, `image/png`
  - `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `text/plain`

**Path Structure:**
```
recommendation-documents/
  └── recommendations/
      └── {tenant_id}/
          └── {recommendation_id}/
              ├── {timestamp}-{original_filename}.pdf
              └── {timestamp}-{original_filename}.jpg
```

**Example:**
```
recommendation-documents/recommendations/tenant-xyz/REC-001/1706400000000-invoice.pdf
recommendation-documents/recommendations/tenant-xyz/REC-001/1706400000001-receipt.jpg
```

**Database Tracking:**
- Metadata stored in `recommendation_documents` table
- Links documents to recommendations and tenants
- Tracks uploader information and timestamps

## Security Model

### Row Level Security (RLS)

All storage buckets have Row Level Security enabled with the following policies:

#### Reports Bucket Policies

1. **Service Role Full Access**
   - Role: `service_role`
   - Permissions: ALL (SELECT, INSERT, UPDATE, DELETE)
   - Purpose: Backend operations

2. **User Upload to Tenant Folder**
   - Role: `authenticated`
   - Permissions: INSERT
   - Condition: User must have access to the tenant (via `xero_connections`)
   - Purpose: Allow users to upload reports for their organizations

3. **User View Tenant Reports**
   - Role: `authenticated`
   - Permissions: SELECT
   - Condition: User must have access to the tenant
   - Purpose: Allow users to download their organization's reports

4. **User Update Tenant Reports**
   - Role: `authenticated`
   - Permissions: UPDATE
   - Condition: User must have access to the tenant
   - Purpose: Allow users to update metadata or replace reports

5. **User Delete Tenant Reports**
   - Role: `authenticated`
   - Permissions: DELETE
   - Condition: User must have access to the tenant
   - Purpose: Allow users to delete old reports

#### Recommendation Documents Policies

1. **Service Role Full Access**
   - Role: `service_role`
   - Permissions: ALL
   - Purpose: Backend operations

2. **Authenticated Upload**
   - Role: `authenticated`
   - Permissions: INSERT
   - Purpose: Allow authenticated users to upload documents

3. **User View Tenant Documents**
   - Role: `authenticated`
   - Permissions: SELECT
   - Condition: User must have access to the tenant
   - Purpose: Allow users to view their organization's documents

4. **Public View Shared Documents**
   - Role: `anon`, `authenticated`
   - Permissions: SELECT
   - Purpose: Allow access via share links (validated in API layer)
   - Note: Share token validation happens in the API, not RLS

5. **User Delete Tenant Documents**
   - Role: `authenticated`
   - Permissions: DELETE
   - Condition: User must have access to the tenant
   - Purpose: Allow users to delete their organization's documents

### Access Control Flow

```
┌─────────────────────────────────────────┐
│         User Request                     │
│   (with auth token or share token)       │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      API Route Handler                   │
│  - Validate authentication               │
│  - Check tenant access                   │
│  - Validate share token (if applicable)  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│    Supabase Storage RLS Policies         │
│  - Check row-level permissions           │
│  - Verify tenant ownership               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      File Access Granted                 │
└─────────────────────────────────────────┘
```

## Storage Quotas and Limits

### Per-Tenant Quotas

- **Default Storage Quota:** 500 MB per tenant
- **Maximum File Size (Reports):** 50 MB
- **Maximum File Size (Documents):** 10 MB
- **Total Files:** No hard limit (quota-based)

### Quota Enforcement

The `check_storage_quota()` function can be used to validate storage limits:

```sql
SELECT check_storage_quota('tenant-id', 5242880); -- Check if 5 MB can be uploaded
```

**Returns:** `true` if within quota, `false` if over quota

### Monitoring Storage Usage

Use the `get_tenant_storage_usage()` function:

```sql
SELECT * FROM get_tenant_storage_usage('tenant-id');
```

**Returns:**
| bucket_name | file_count | total_size_bytes | total_size_mb |
|------------|-----------|-----------------|---------------|
| reports | 15 | 25165824 | 24.00 |
| recommendation-documents | 8 | 5242880 | 5.00 |

## Lifecycle Management

### Automatic Cleanup

The `cleanup_old_reports()` function removes reports older than specified days:

```sql
SELECT * FROM cleanup_old_reports(90); -- Delete reports older than 90 days
```

**Returns:**
| deleted_count | freed_bytes |
|--------------|-------------|
| 42 | 125829120 |

**What Gets Cleaned:**
1. Report files in storage
2. Corresponding database records in `generated_reports`

**Retention Policy:**
- **Default:** 90 days for generated reports
- **Recommendation Documents:** No automatic cleanup (user-managed)

### Manual Cleanup Scripts

#### Verify Storage Setup
```bash
npx ts-node scripts/verify-storage-setup.ts
npx ts-node scripts/verify-storage-setup.ts --test-upload
npx ts-node scripts/verify-storage-setup.ts --stats
```

#### Run Storage Cleanup
```bash
# Dry run (preview what would be deleted)
npx ts-node scripts/storage-cleanup.ts --dry-run

# Delete reports older than 60 days
npx ts-node scripts/storage-cleanup.ts --days 60

# Clean up orphaned files only
npx ts-node scripts/storage-cleanup.ts --orphaned-only

# Full cleanup
npx ts-node scripts/storage-cleanup.ts
```

### Cron Job Setup

Add to production environment crontab:

```bash
# Run cleanup daily at 2 AM
0 2 * * * cd /path/to/app && npx ts-node scripts/storage-cleanup.ts --days 90
```

Or use Vercel Cron:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/storage-cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

## Best Practices

### File Uploads

1. **Always validate file size** before uploading:
```typescript
if (file.size > 10 * 1024 * 1024) {
  throw new Error('File size exceeds 10 MB limit');
}
```

2. **Validate MIME type** before uploading:
```typescript
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
if (!allowedTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

3. **Use unique filenames** to prevent conflicts:
```typescript
const filename = `${Date.now()}-${originalFilename}`;
```

4. **Use upsert: true** for reports that may be regenerated:
```typescript
await supabase.storage
  .from('reports')
  .upload(path, buffer, { upsert: true });
```

### File Downloads

1. **Track downloads** for analytics:
```sql
SELECT track_report_download('REP-123456');
```

2. **Set appropriate headers**:
```typescript
return new NextResponse(buffer, {
  headers: {
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.byteLength.toString(),
  },
});
```

3. **Handle errors gracefully**:
```typescript
const { data, error } = await supabase.storage
  .from('reports')
  .download(path);

if (error) {
  console.error('Download failed:', error);
  return NextResponse.json(
    { error: 'File not found' },
    { status: 404 }
  );
}
```

### Error Handling

Common storage errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `Bucket not found` | Bucket not created | Run migration `007_create_storage_buckets.sql` |
| `Object not found` | File doesn't exist | Check path and verify upload succeeded |
| `Policy violation` | User lacks permissions | Verify RLS policies and user tenant access |
| `File too large` | Exceeds size limit | Reduce file size or increase bucket limit |
| `Invalid MIME type` | Unsupported file type | Check allowed types in bucket config |

## Performance Optimization

### Upload Performance

- **Use service role** for bulk operations to bypass RLS checks
- **Upload in parallel** for multiple files (max 5 concurrent)
- **Compress files** before uploading when possible
- **Use CDN** for frequently accessed files (if bucket is public)

### Download Performance

- **Cache generated reports** to avoid regeneration
- **Use signed URLs** for temporary access (expires after 60 seconds)
- **Implement pagination** for file listings

### Storage Costs

**Supabase Storage Pricing (as of 2026):**
- **Storage:** $0.021 per GB/month
- **Egress (downloads):** $0.09 per GB
- **Free tier:** 1 GB storage, 2 GB egress per month

**Cost Management:**
1. Implement aggressive cleanup policies (60-90 days)
2. Monitor storage usage per tenant
3. Implement download quotas for external sharing
4. Compress large files before storage

## Troubleshooting

### Common Issues

#### Storage Verification Failed

```bash
❌ Required bucket 'reports' not found
```

**Solution:**
```bash
# Run the storage setup migration
cd supabase
psql -U postgres -d your_database -f migrations/007_create_storage_buckets.sql
```

#### Upload Failed: Policy Violation

```typescript
{
  error: 'new row violates row-level security policy'
}
```

**Solution:**
1. Verify user is authenticated
2. Check user has access to tenant in `xero_connections`
3. Verify RLS policies are correctly configured

#### Storage Quota Exceeded

```typescript
{
  error: 'Storage quota exceeded for tenant'
}
```

**Solution:**
1. Run cleanup script to free space
2. Increase tenant quota in database
3. Contact user to delete unnecessary files

### Debugging

Enable storage debugging in development:

```typescript
// lib/storage/debug.ts
export async function debugStorageAccess(userId: string, path: string) {
  const supabase = await createServiceClient();

  // Check user's tenant access
  const { data: tenants } = await supabase
    .from('xero_connections')
    .select('xero_tenant_id')
    .eq('user_id', userId);

  console.log('User tenants:', tenants);

  // Check file existence
  const { data: file } = await supabase.storage
    .from('reports')
    .list(path);

  console.log('File exists:', file);

  // Check RLS policies
  const { data: policies } = await supabase
    .rpc('get_storage_policies', { bucket_id: 'reports' });

  console.log('RLS policies:', policies);
}
```

## Migration Checklist

When deploying storage to production:

- [ ] Run migration `007_create_storage_buckets.sql`
- [ ] Verify buckets exist: `npx ts-node scripts/verify-storage-setup.ts`
- [ ] Test file upload: `npx ts-node scripts/verify-storage-setup.ts --test-upload`
- [ ] Configure cron job for cleanup
- [ ] Set up monitoring alerts for storage usage
- [ ] Document storage costs in production budget
- [ ] Test RLS policies with different user roles
- [ ] Verify backup/restore procedures

## Support

For storage-related issues:

1. Check logs: `SELECT * FROM storage.objects WHERE bucket_id = 'reports' ORDER BY created_at DESC LIMIT 100;`
2. Verify policies: Review RLS policies in Supabase dashboard
3. Monitor usage: Use `get_tenant_storage_usage()` function
4. Run diagnostics: Use verification scripts in `/scripts`

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Policies Examples](https://supabase.com/docs/guides/storage/security/access-control)
