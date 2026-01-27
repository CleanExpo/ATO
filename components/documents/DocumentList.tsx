'use client';

/**
 * DocumentList Component
 *
 * Displays a list/grid of documents with sorting and filtering.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentCard, DocumentCardCompact } from './DocumentCard';
import { type DocumentWithUrl } from '@/lib/types/recommendation-documents';

type SortBy = 'date' | 'name' | 'size';
type SortOrder = 'asc' | 'desc';

interface DocumentListProps {
  documents: DocumentWithUrl[];
  onDelete?: (documentId: string) => Promise<void>;
  canDelete?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

export function DocumentList({
  documents,
  onDelete,
  canDelete = false,
  compact = false,
  emptyMessage = 'No documents uploaded yet',
}: DocumentListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedDocuments = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.fileName.localeCompare(b.fileName);
        case 'size':
          return a.fileSize - b.fileSize;
        default:
          return 0;
      }
    });
    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  }, [documents, sortBy, sortOrder]);

  const toggleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 bg-white/5 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-sm text-white/50">{emptyMessage}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {sortedDocuments.map((doc) => (
          <DocumentCardCompact key={doc.id} document={doc} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort Controls */}
      {documents.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Sort by:</span>
          <button
            onClick={() => toggleSort('date')}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'date' ? 'bg-white/10 text-white' : 'hover:bg-white/5'
            }`}
          >
            Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => toggleSort('name')}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'name' ? 'bg-white/10 text-white' : 'hover:bg-white/5'
            }`}
          >
            Name {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => toggleSort('size')}
            className={`px-2 py-1 rounded transition-colors ${
              sortBy === 'size' ? 'bg-white/10 text-white' : 'hover:bg-white/5'
            }`}
          >
            Size {sortBy === 'size' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      )}

      {/* Document Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {sortedDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={onDelete}
              canDelete={canDelete}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <div className="text-xs text-white/40 pt-2">
        {documents.length} document{documents.length !== 1 ? 's' : ''}
        {' • '}
        {documents.filter((d) => d.uploadedByType === 'owner').length} from owner
        {' • '}
        {documents.filter((d) => d.uploadedByType === 'accountant').length} from accountant
      </div>
    </div>
  );
}

/**
 * Document count badge for displaying in headers
 */
export function DocumentCountBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
      {count}
    </span>
  );
}
