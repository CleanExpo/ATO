/**
 * File Content Scanner (B-3)
 *
 * Validates uploaded file content beyond client-reported MIME type.
 * Serverless-compatible (no external binaries like ClamAV required).
 *
 * Checks performed:
 * 1. Magic number validation — file signature must match claimed MIME type
 * 2. Double extension detection — rejects "invoice.pdf.exe" patterns
 * 3. Null byte injection prevention — rejects filenames with null bytes
 * 4. Embedded threat detection — checks for dangerous patterns in file content
 */

/** Magic number signatures for allowed file types */
const MAGIC_NUMBERS: Record<string, { offset: number; bytes: number[] }[]> = {
  // PDF: starts with %PDF
  'application/pdf': [
    { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  ],
  // JPEG: starts with FF D8 FF
  'image/jpeg': [
    { offset: 0, bytes: [0xff, 0xd8, 0xff] },
  ],
  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  'image/png': [
    { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  ],
  // DOC (OLE2 compound): starts with D0 CF 11 E0
  'application/msword': [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  ],
  // DOCX/XLSX (ZIP-based OOXML): starts with PK (50 4B 03 04)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  // XLS (OLE2 compound): same as DOC
  'application/vnd.ms-excel': [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  ],
  // XLSX (ZIP-based OOXML): same as DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
}

/** Executable file signatures to reject regardless of claimed type */
const DANGEROUS_SIGNATURES = [
  // Windows PE executable: MZ header
  { offset: 0, bytes: [0x4d, 0x5a], label: 'Windows executable (MZ)' },
  // ELF binary (Linux)
  { offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF binary' },
  // Mach-O binary (macOS)
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xce], label: 'Mach-O binary' },
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xcf], label: 'Mach-O 64-bit binary' },
  // Shell script
  { offset: 0, bytes: [0x23, 0x21], label: 'Shell script (#!)' },
]

/** Dangerous file extensions (double extension attack) */
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
  '.sh', '.bash', '.csh', '.ksh', '.dll', '.sys', '.drv',
]

export interface ScanResult {
  safe: boolean
  reason?: string
  code?: 'MAGIC_MISMATCH' | 'DANGEROUS_CONTENT' | 'DANGEROUS_FILENAME' | 'NULL_BYTE'
}

/**
 * Scan uploaded file content for safety.
 *
 * @param fileName - Original filename from upload
 * @param claimedMimeType - MIME type reported by the client
 * @param fileBuffer - Raw file content as ArrayBuffer
 * @returns ScanResult indicating whether the file is safe to store
 */
export function scanFile(
  fileName: string,
  claimedMimeType: string,
  fileBuffer: ArrayBuffer
): ScanResult {
  // 1. Null byte injection in filename
  if (fileName.includes('\0')) {
    return {
      safe: false,
      reason: 'Filename contains null bytes',
      code: 'NULL_BYTE',
    }
  }

  // 2. Double extension detection (e.g., "report.pdf.exe")
  const lowerName = fileName.toLowerCase()
  const parts = lowerName.split('.')
  if (parts.length > 2) {
    // Check if any non-final extension is dangerous
    for (let i = 1; i < parts.length; i++) {
      const ext = '.' + parts[i]
      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        return {
          safe: false,
          reason: `Filename contains dangerous extension: ${ext}`,
          code: 'DANGEROUS_FILENAME',
        }
      }
    }
  }

  const bytes = new Uint8Array(fileBuffer)

  // 3. Check for dangerous executable signatures regardless of claimed type
  for (const sig of DANGEROUS_SIGNATURES) {
    if (matchesSignature(bytes, sig.offset, sig.bytes)) {
      return {
        safe: false,
        reason: `File content matches dangerous signature: ${sig.label}`,
        code: 'DANGEROUS_CONTENT',
      }
    }
  }

  // 4. Magic number validation — verify file content matches claimed MIME type
  const expectedSignatures = MAGIC_NUMBERS[claimedMimeType]
  if (expectedSignatures) {
    const matchesAny = expectedSignatures.some(
      sig => matchesSignature(bytes, sig.offset, sig.bytes)
    )

    if (!matchesAny) {
      return {
        safe: false,
        reason: `File content does not match claimed type "${claimedMimeType}". ` +
          'The file may have been renamed or the content type spoofed.',
        code: 'MAGIC_MISMATCH',
      }
    }
  }

  return { safe: true }
}

/**
 * Check if file bytes match an expected signature at a given offset.
 */
function matchesSignature(
  fileBytes: Uint8Array,
  offset: number,
  expectedBytes: number[]
): boolean {
  if (fileBytes.length < offset + expectedBytes.length) {
    return false
  }
  return expectedBytes.every((byte, i) => fileBytes[offset + i] === byte)
}
