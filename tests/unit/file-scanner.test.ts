/**
 * Tests for File Content Scanner (lib/uploads/file-scanner.ts)
 *
 * Validates B-3 security controls:
 * - Magic number validation (file signature vs claimed MIME type)
 * - Dangerous executable detection (MZ, ELF, Mach-O, shebang)
 * - Double extension prevention
 * - Null byte injection prevention
 */

import { describe, it, expect } from 'vitest'
import { scanFile, type ScanResult } from '@/lib/uploads/file-scanner'

/** Helper to create ArrayBuffer from byte array */
function bytesToBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

/** Valid PDF magic bytes */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34] // %PDF-1.4

/** Valid JPEG magic bytes */
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]

/** Valid PNG magic bytes */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Windows PE (MZ) executable bytes */
const MZ_BYTES = [0x4d, 0x5a, 0x90, 0x00]

/** ELF binary bytes */
const ELF_BYTES = [0x7f, 0x45, 0x4c, 0x46]

/** Shell script (#!) bytes */
const SHEBANG_BYTES = [0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e] // #!/bin

/** ZIP/OOXML magic bytes (PK) */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

describe('File Scanner — Null Byte Injection', () => {
  it('should reject filenames with null bytes', () => {
    const result = scanFile('report\0.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('NULL_BYTE')
  })

  it('should accept normal filenames', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })
})

describe('File Scanner — Double Extension Detection', () => {
  it('should reject .pdf.exe double extension', () => {
    const result = scanFile('report.pdf.exe', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_FILENAME')
  })

  it('should reject .doc.bat double extension', () => {
    const result = scanFile('invoice.doc.bat', 'application/msword', bytesToBuffer([0xd0, 0xcf, 0x11, 0xe0]))
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

  it('should allow normal single-extension filenames', () => {
    const result = scanFile('report.pdf', 'application/pdf', bytesToBuffer(PDF_MAGIC))
    expect(result.safe).toBe(true)
  })
})

describe('File Scanner — Dangerous Executable Detection', () => {
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

  it('should reject Mach-O binary', () => {
    const result = scanFile('app', 'application/octet-stream', bytesToBuffer([0xfe, 0xed, 0xfa, 0xce]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('Mach-O')
  })

  it('should reject Mach-O 64-bit binary', () => {
    const result = scanFile('app64', 'application/octet-stream', bytesToBuffer([0xfe, 0xed, 0xfa, 0xcf]))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
  })

  it('should reject shell scripts (#!)', () => {
    const result = scanFile('script.sh', 'text/plain', bytesToBuffer(SHEBANG_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
    expect(result.reason).toContain('Shell script')
  })

  it('should reject executable disguised as PDF', () => {
    // MZ header but claimed as PDF
    const result = scanFile('invoice.pdf', 'application/pdf', bytesToBuffer(MZ_BYTES))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('DANGEROUS_CONTENT')
  })
})

describe('File Scanner — Magic Number Validation', () => {
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

  it('should accept valid XLSX (ZIP) with correct magic number', () => {
    const result = scanFile(
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytesToBuffer(ZIP_MAGIC)
    )
    expect(result.safe).toBe(true)
  })

  it('should reject JPEG content claimed as PDF', () => {
    const result = scanFile('fake.pdf', 'application/pdf', bytesToBuffer(JPEG_MAGIC))
    expect(result.safe).toBe(false)
    expect(result.code).toBe('MAGIC_MISMATCH')
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

  it('should accept unknown MIME types (no magic number check)', () => {
    // text/plain has no magic number in the list — should pass
    const result = scanFile('notes.txt', 'text/plain', bytesToBuffer([0x48, 0x65, 0x6c, 0x6c, 0x6f])) // "Hello"
    expect(result.safe).toBe(true)
  })
})

describe('File Scanner — Edge Cases', () => {
  it('should handle empty file buffer', () => {
    const result = scanFile('empty.pdf', 'application/pdf', bytesToBuffer([]))
    // Empty file can't match PDF magic → MAGIC_MISMATCH
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
})
