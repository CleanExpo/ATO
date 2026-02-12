/**
 * Tests for File Content Scanner (lib/uploads/file-scanner.ts)
 *
 * Validates B-3 security controls:
 * - Magic number validation (file signature vs claimed MIME type)
 * - Dangerous executable detection (MZ, ELF, Mach-O, shebang)
 * - Double extension prevention
 * - Null byte injection prevention
 * - Edge cases: empty buffers, unknown MIME types, special filenames
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { scanFile, type ScanResult } from '@/lib/uploads/file-scanner'

/** Helper to create ArrayBuffer from byte array */
function bytesToBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

// Common magic byte sequences
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34] // %PDF-1.4
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]
const MZ_BYTES = [0x4d, 0x5a, 0x90, 0x00]
const ELF_BYTES = [0x7f, 0x45, 0x4c, 0x46]
const MACHO_BYTES = [0xfe, 0xed, 0xfa, 0xce]
const MACHO64_BYTES = [0xfe, 0xed, 0xfa, 0xcf]
const SHEBANG_BYTES = [0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e] // #!/bin

// =============================================================================
// Null byte injection
// =============================================================================

describe('File Scanner -- Null Byte Injection', () => {
  it('should reject filenames with null bytes', () => {
    const result = scanFile('report\0.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('NULL_BYTE')
    expect(result.reason).toContain('null bytes')
  })

  it('should reject null byte in the middle of filename', () => {
    const result = scanFile('repo\0rt.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('NULL_BYTE')
  })

  it('should accept normal filenames without null bytes', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })
})

// =============================================================================
// Double extension detection
// =============================================================================

describe('File Scanner -- Double Extension Detection', () => {
  it('should reject .pdf.exe double extension', () => {
    const result = scanFile('report.pdf.exe', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
    expect(result.reason).toContain('.exe')
  })

  it('should reject .doc.bat double extension', () => {
    const result = scanFile('invoice.doc.bat', 'application/msword', bytesToBuffer(OLE2_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .jpg.vbs double extension', () => {
    const result = scanFile('photo.jpg.vbs', 'image/jpeg', bytesToBuffer(JPEG_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .png.ps1 double extension', () => {
    const result = scanFile('image.png.ps1', 'image/png', bytesToBuffer(PNG_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .xlsx.cmd double extension', () => {
    const result = scanFile('data.xlsx.cmd', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytesToBuffer(ZIP_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .pdf.msi double extension', () => {
    const result = scanFile('setup.pdf.msi', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .txt.sh double extension', () => {
    const result = scanFile('readme.txt.sh', 'text/plain', bytesToBuffer([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should allow normal single-extension filenames', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should be case-insensitive for dangerous extensions', () => {
    const result = scanFile('report.pdf.EXE', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })
})

// =============================================================================
// Dangerous executable detection
// =============================================================================

describe('File Scanner -- Dangerous Executable Detection', () => {
  it('should reject Windows PE executable (MZ header)', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(MZ_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('MZ')
  })

  it('should reject ELF binary', () => {
    const result = scanFile('data.bin', 'application/octet-stream', bytesToBuffer(ELF_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('ELF')
  })

  it('should reject Mach-O binary (32-bit)', () => {
    const result = scanFile('app', 'application/octet-stream', bytesToBuffer(MACHO_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('Mach-O')
  })

  it('should reject Mach-O binary (64-bit)', () => {
    const result = scanFile('app64', 'application/octet-stream', bytesToBuffer(MACHO64_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('Mach-O')
  })

  it('should reject shell scripts (#!)', () => {
    const result = scanFile('script.sh', 'text/plain', bytesToBuffer(SHEBANG_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('Shell script')
  })

  it('should reject executable disguised as PDF', () => {
    const result = scanFile('invoice.pdf', 'application/pdf', bytesToBuffer(MZ_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
  })

  it('should reject executable disguised as JPEG', () => {
    const result = scanFile('photo.jpg', 'image/jpeg', bytesToBuffer(ELF_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
  })
})

// =============================================================================
// Magic number validation
// =============================================================================

describe('File Scanner -- Magic Number Validation', () => {
  it('should accept valid PDF with correct magic number', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should accept valid JPEG with correct magic number', () => {
    const result = scanFile('photo.jpg', 'image/jpeg', bytesToBuffer(JPEG_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should accept valid PNG with correct magic number', () => {
    const result = scanFile('image.png', 'image/png', bytesToBuffer(PNG_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should accept valid XLSX (ZIP-based OOXML)', () => {
    const result = scanFile(
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytesToBuffer(ZIP_MAGIC)
    )
    expect(result.safe).toBe(true)
  })

  it('should accept valid DOCX (ZIP-based OOXML)', () => {
    const result = scanFile(
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytesToBuffer(ZIP_MAGIC)
    )
    expect(result.safe).toBe(true)
  })

  it('should accept valid DOC (OLE2 compound)', () => {
    const result = scanFile('old-doc.doc', 'application/msword', bytesToBuffer(OLE2_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should accept valid XLS (OLE2 compound)', () => {
    const result = scanFile('data.xls', 'application/vnd.ms-excel', bytesToBuffer(OLE2_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should reject JPEG content claimed as PDF (magic mismatch)', () => {
    const result = scanFile('fake.pdf', 'application/pdf', bytesToBuffer(JPEG_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
    expect(result.reason).toContain('does not match claimed type')
  })

  it('should reject PNG content claimed as JPEG', () => {
    const result = scanFile('fake.jpg', 'image/jpeg', bytesToBuffer(PNG_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
  })

  it('should reject random bytes claimed as PDF', () => {
    const result = scanFile('random.pdf', 'application/pdf', bytesToBuffer([0x00, 0x01, 0x02, 0x03]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
  })

  it('should accept unknown MIME types without magic number check', () => {
    const result = scanFile('notes.txt', 'text/plain', bytesToBuffer([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
    expect(result.safe).toBe(true)
  })

  it('should accept application/octet-stream without magic number check', () => {
    // Only fails if content matches a dangerous signature
    const safeBinary = [0x00, 0x00, 0x00, 0x00, 0x00]
    const result = scanFile('data.bin', 'application/octet-stream', bytesToBuffer(safeBinary))
    expect(result.safe).toBe(true)
  })
})

// =============================================================================
// Edge cases
// =============================================================================

describe('File Scanner -- Edge Cases', () => {
  it('should reject empty file buffer with known MIME type (magic mismatch)', () => {
    const result = scanFile('empty.pdf', 'application/pdf', bytesToBuffer([]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
  })

  it('should handle very short file buffer', () => {
    const result = scanFile('tiny.pdf', 'application/pdf', bytesToBuffer([0x25]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
  })

  it('should handle filename with spaces and special chars', () => {
    const result = scanFile('my report (final).pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should handle filename with dashes and underscores', () => {
    const result = scanFile('tax-report_2024-25.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })

  it('should accept empty file with unknown MIME type', () => {
    const result = scanFile('empty.txt', 'text/plain', bytesToBuffer([]))
    expect(result.safe).toBe(true)
  })

  it('should return safe:true with no reason/code for safe files', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result).toEqual({ safe: true })
    expect(result.reason).toBeUndefined()
    expect(result.code).toBeUndefined()
  })
})
