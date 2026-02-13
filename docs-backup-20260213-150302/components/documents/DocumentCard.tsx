'use client';

/**
 * DocumentCard Component
 *
 * Displays a single document with download and delete actions.
 * Shows file icon, name, size, and upload info.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  formatFileSize,
  getFileIcon,
  type DocumentWithUrl,
} from '@/lib/types/recommendation-documents';

interface DocumentCardProps {
  document: DocumentWithUrl;
  onDelete?: (documentId: string) => Promise<void>;
  canDelete?: boolean;
}

export function DocumentCard({ document, onDelete, canDelete = false }: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(document.id);
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const icon = getFileIcon(document.fileType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* File Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-xl">
          {icon}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate" title={document.fileName}>
            {document.fileName}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
            <span>{formatFileSize(document.fileSize)}</span>
            <span>•</span>
            <span>{formatDate(document.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span
              className={`px-1.5 py-0.5 rounded ${
                document.uploadedByType === 'accountant'
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'bg-violet-500/10 text-violet-400'
              }`}
            >
              {document.uploadedByType === 'accountant' ? 'Accountant' : 'Owner'}
            </span>
            <span className="text-white/40 truncate">{document.uploadedByName}</span>
          </div>
          {document.description && (
            <p className="mt-2 text-xs text-white/60 line-clamp-2">{document.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={document.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </a>
          {canDelete && onDelete && (
            <>
              {showConfirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                    title="Confirm delete"
                  >
                    {isDeleting ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="p-1.5 text-white/50 hover:bg-white/5 rounded transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Compact document card for inline display
 */
export function DocumentCardCompact({ document }: { document: DocumentWithUrl }) {
  const icon = getFileIcon(document.fileType);

  return (
    <a
      href={document.downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/70 hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span className="truncate max-w-[120px]">{document.fileName}</span>
    </a>
  );
}
