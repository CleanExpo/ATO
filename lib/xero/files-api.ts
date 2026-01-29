/**
 * Xero Files API Integration
 *
 * Uploads reports and documents to the Xero Files section
 * so accountants can access findings directly from Xero.
 *
 * Requires OAuth scope: 'files'
 */

import { XeroClient, TokenSet } from 'xero-node'
import { createServiceClient } from '@/lib/supabase/server'
import { createXeroClient, isTokenExpired, refreshXeroTokens } from '@/lib/xero/client'
import { withRetry } from '@/lib/xero/retry'

const ATO_FOLDER_NAME = 'ATO Tax Optimizer Reports'

export interface UploadReportOptions {
  tenantId: string
  fileName: string
  fileContent: Buffer
  mimeType: 'application/pdf' | 'text/html' | 'text/plain'
}

export interface UploadResult {
  success: boolean
  fileId?: string
  fileName?: string
  folderId?: string
  xeroFileUrl?: string
  error?: string
}

/**
 * Upload a report file to Xero Files.
 * Creates an "ATO Tax Optimizer Reports" folder if it doesn't exist.
 */
export async function uploadReportToXero(options: UploadReportOptions): Promise<UploadResult> {
  const { tenantId, fileName, fileContent, mimeType } = options

  try {
    const client = await getAuthenticatedClient(tenantId)

    // Ensure our folder exists
    const folderId = await ensureFolder(client, tenantId)

    // Upload the file via Xero Files API (raw HTTP)
    const result = await withRetry(
      async () => {
        const tokenSet = client.readTokenSet()
        const accessToken = tokenSet.access_token

        const formData = new FormData()
        const blob = new Blob([new Uint8Array(fileContent)], { type: mimeType })
        formData.append('File', blob, fileName)
        formData.append('FolderId', folderId)

        const uploadResponse = await fetch('https://api.xero.com/files.xro/1.0/Files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Xero-Tenant-Id': tenantId,
          },
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          throw new Error(`Xero Files upload failed: ${uploadResponse.status} ${errorText}`)
        }

        return await uploadResponse.json()
      },
      {
        maxAttempts: 3,
        timeoutMs: 60000,
        initialBackoffMs: 2000,
      }
    )

    return {
      success: true,
      fileId: result.Id,
      fileName: result.Name,
      folderId,
      xeroFileUrl: `https://go.xero.com/organisationlogin/default.aspx?shortcode=!&redirecturl=/files/${result.Id}`,
    }
  } catch (error) {
    console.error('Failed to upload report to Xero:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Ensure the ATO Tax Optimizer folder exists in Xero Files.
 * Returns the folder ID.
 */
async function ensureFolder(client: XeroClient, tenantId: string): Promise<string> {
  const tokenSet = client.readTokenSet()
  const accessToken = tokenSet.access_token

  // List existing folders
  const listResponse = await fetch('https://api.xero.com/files.xro/1.0/Folders', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
    },
  })

  if (!listResponse.ok) {
    throw new Error(`Failed to list Xero folders: ${listResponse.status}`)
  }

  const folders = await listResponse.json()

  // Check if our folder already exists
  const existing = Array.isArray(folders)
    ? folders.find((f: { Name: string }) => f.Name === ATO_FOLDER_NAME)
    : null

  if (existing) {
    return existing.Id
  }

  // Create the folder
  const createResponse = await fetch('https://api.xero.com/files.xro/1.0/Folders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ Name: ATO_FOLDER_NAME }),
  })

  if (!createResponse.ok) {
    throw new Error(`Failed to create Xero folder: ${createResponse.status}`)
  }

  const newFolder = await createResponse.json()
  return newFolder.Id
}

/**
 * Get an authenticated XeroClient for the given tenant.
 * Refreshes tokens if needed.
 */
async function getAuthenticatedClient(tenantId: string): Promise<XeroClient> {
  const supabase = await createServiceClient()

  const { data: connection, error } = await supabase
    .from('xero_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !connection) {
    throw new Error(`No Xero connection found for tenant ${tenantId}`)
  }

  let tokenSet = {
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expires_at: connection.expires_at,
    id_token: connection.id_token,
    scope: connection.scope,
    token_type: 'Bearer',
  } as TokenSet

  // Refresh if expired
  if (isTokenExpired(tokenSet)) {
    tokenSet = await refreshXeroTokens(tokenSet)

    // Save refreshed tokens
    await supabase
      .from('xero_connections')
      .update({
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_at,
        id_token: tokenSet.id_token,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
  }

  const client = createXeroClient()
  await client.initialize()
  client.setTokenSet(tokenSet)

  return client
}

/**
 * List all files in the ATO Tax Optimizer folder.
 */
export async function listReportsInXero(
  tenantId: string
): Promise<Array<{ fileId: string; name: string; createdAt: string; size: number }>> {
  try {
    const client = await getAuthenticatedClient(tenantId)
    const tokenSet = client.readTokenSet()
    const accessToken = tokenSet.access_token

    // Find our folder
    const listResponse = await fetch('https://api.xero.com/files.xro/1.0/Folders', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
      },
    })

    if (!listResponse.ok) return []

    const folders = await listResponse.json()
    const atoFolder = Array.isArray(folders)
      ? folders.find((f: { Name: string }) => f.Name === ATO_FOLDER_NAME)
      : null

    if (!atoFolder) return []

    // Get files in folder
    const filesResponse = await fetch(
      `https://api.xero.com/files.xro/1.0/Folders/${atoFolder.Id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-Tenant-Id': tenantId,
        },
      }
    )

    if (!filesResponse.ok) return []

    const folderData = await filesResponse.json()
    const files = folderData.Files || []

    return files.map((f: { Id: string; Name: string; CreatedDateUtc: string; Size: number }) => ({
      fileId: f.Id,
      name: f.Name,
      createdAt: f.CreatedDateUtc,
      size: f.Size,
    }))
  } catch (error) {
    console.error('Failed to list Xero files:', error)
    return []
  }
}
