'use client';

/**
 * DocumentUpload Component
 *
 * Drag-and-drop file upload with progress indicator.
 * Validates file type and size before upload.
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  validateFile,
  formatFileSize,
  getFileIcon,
  MAX_FILE_SIZE_LABEL,
  ALLOWED_EXTENSIONS,
  type RecommendationDocument,
} from '@/lib/types/recommendation-documents';

interface DocumentUploadProps {
  recommendationId: string;
  onUpload: (file: File, description?: string) => Promise<RecommendationDocument>;
  onUploadComplete?: () => void;
  disabled?: boolean;
  suggestedTypes?: string[];
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

export function DocumentUpload({
  recommendationId,
  onUpload,
  onUploadComplete,
  disabled = false,
  suggestedTypes,
}: DocumentUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setState('dragging');
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState('idle');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState('idle');

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [disabled]
  );

  const handleFileSelect = (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setState('error');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setState('idle');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setState('uploading');
    setUploadProgress(0);

    // Simulate progress (actual upload doesn't have progress events)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      await onUpload(selectedFile, description || undefined);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setState('success');

      // Reset after success
      setTimeout(() => {
        setSelectedFile(null);
        setDescription('');
        setState('idle');
        setUploadProgress(0);
        onUploadComplete?.();
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setDescription('');
    setError(null);
    setState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const icon = selectedFile ? getFileIcon(selectedFile.type) : '📎';

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed border-white/10' : ''}
          ${state === 'dragging' ? 'border-violet-500 bg-violet-500/5' : 'border-white/10 hover:border-white/20'}
          ${state === 'error' ? 'border-red-500/50 bg-red-500/5' : ''}
          ${state === 'success' ? 'border-green-500/50 bg-green-500/5' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          disabled={disabled}
        />

        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs text-white/50">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              {/* Description Input */}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                disabled={state === 'uploading'}
              />

              {/* Progress Bar */}
              {state === 'uploading' && (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-2">
                {state === 'uploading' ? (
                  <span className="text-sm text-white/50">Uploading...</span>
                ) : state === 'success' ? (
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Uploaded successfully
                  </span>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      className="px-3 py-1.5 text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-colors"
                    >
                      Upload
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="w-12 h-12 mx-auto bg-white/5 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white/70">
                  <span className="text-violet-400">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {ALLOWED_EXTENSIONS.join(', ')} up to {MAX_FILE_SIZE_LABEL}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 -bottom-8 text-center"
          >
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Suggested Documents */}
      {suggestedTypes && suggestedTypes.length > 0 && !selectedFile && (
        <div className="text-xs text-white/40">
          <span className="font-medium text-white/50">Suggested:</span>{' '}
          {suggestedTypes.slice(0, 3).join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * Compact upload button for inline use
 */
export function DocumentUploadButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/5 border border-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Add Document
    </button>
  );
}
