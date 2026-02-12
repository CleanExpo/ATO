'use client'

/**
 * Standardised Pagination Component
 *
 * Scientific Luxury Design System implementation.
 * Supports both 0-indexed and 1-indexed page numbering via props.
 * Works with both client-side and server-side pagination patterns.
 */

// ─── Design Tokens ───────────────────────────────────────────────────

const SPECTRAL_CYAN = '#00F5FF'

// ─── Types ───────────────────────────────────────────────────────────

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback when page changes (receives 1-indexed page number) */
  onPageChange: (page: number) => void
  /** Currently selected page size */
  pageSize?: number
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Optional "Showing X-Y of Z" display */
  showing?: { from: number; to: number; total: number }
}

// ─── Component ───────────────────────────────────────────────────────

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showing,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 w-full">
        {/* Page Size Selector */}
        {pageSize != null && onPageSizeChange && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
              Page Size
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              aria-label="Items per page"
              className="px-2 py-1 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 focus:outline-none focus:border-white/[0.2]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size} className="bg-[#0a0a0f]">
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={isFirstPage}
            aria-label="Go to previous page"
            className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            Previous
          </button>

          <span className="px-3 text-sm text-white/30 font-mono tabular-nums">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={isLastPage}
            aria-label="Go to next page"
            className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Showing X-Y of Z */}
      {showing && (
        <p className="text-[10px] text-white/20 font-mono tabular-nums tracking-wider">
          Showing {showing.from}&ndash;{showing.to} of {showing.total.toLocaleString()}
        </p>
      )}
    </nav>
  )
}

// ─── Numbered Variant ────────────────────────────────────────────────

/**
 * Pagination variant with clickable page number buttons.
 * Useful for smaller datasets where direct page access is valuable.
 */

export interface NumberedPaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback when page changes (receives 1-indexed page number) */
  onPageChange: (page: number) => void
  /** Currently selected page size */
  pageSize?: number
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Optional "Showing X-Y of Z" display */
  showing?: { from: number; to: number; total: number }
}

export function NumberedPagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showing,
}: NumberedPaginationProps) {
  if (totalPages <= 1) return null

  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages

  // Build page numbers with ellipsis
  const pageNumbers = buildPageNumbers(currentPage, totalPages)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 w-full">
        {/* Showing X-Y of Z */}
        {showing && (
          <span className="text-[10px] text-white/20 font-mono tabular-nums tracking-wider">
            Showing {showing.from}&ndash;{showing.to} of {showing.total.toLocaleString()}
          </span>
        )}

        {/* Page Size Selector */}
        {pageSize != null && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              aria-label="Items per page"
              className="px-2 py-1 bg-transparent border-[0.5px] border-white/[0.1] rounded-sm text-sm text-white/70 text-xs focus:outline-none focus:border-white/[0.2]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size} className="bg-[#0a0a0f]">
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={isFirstPage}
            aria-label="Go to previous page"
            className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e${idx}`} className="px-2 text-xs text-white/20">
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-label={`Go to page ${item}`}
                aria-current={currentPage === item ? 'page' : undefined}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors border-[0.5px] ${
                  currentPage === item
                    ? 'font-bold'
                    : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.03]'
                }`}
                style={
                  currentPage === item
                    ? {
                        borderColor: `${SPECTRAL_CYAN}40`,
                        color: SPECTRAL_CYAN,
                        backgroundColor: `${SPECTRAL_CYAN}10`,
                      }
                    : undefined
                }
              >
                {item}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={isLastPage}
            aria-label="Go to next page"
            className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] border-[0.5px] border-white/[0.06] rounded-sm text-white/40 hover:text-white/70 hover:border-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'rgba(255,255,255,0.01)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildPageNumbers(
  currentPage: number,
  totalPages: number
): (number | 'ellipsis')[] {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const visible = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  )

  const result: (number | 'ellipsis')[] = []
  for (let i = 0; i < visible.length; i++) {
    if (i > 0 && visible[i] - visible[i - 1] > 1) {
      result.push('ellipsis')
    }
    result.push(visible[i])
  }
  return result
}
