'use client';

/**
 * CreateShareModal
 *
 * Modal for creating a new share link with options for:
 * - Report type selection
 * - Expiry duration
 * - Password protection
 * - Custom title and description
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShareableReportType,
  REPORT_TYPE_LABELS,
  EXPIRY_OPTIONS,
  CreateShareLinkResponse,
} from '@/lib/types/shared-reports';

interface CreateShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  defaultReportType?: ShareableReportType;
  defaultTitle?: string;
  onSuccess?: (response: CreateShareLinkResponse) => void;
}

const SPECTRAL = {
  violet: '#8B5CF6',
  blue: '#3B82F6',
  cyan: '#06B6D4',
  green: '#10B981',
  amber: '#F59E0B',
};

export function CreateShareModal({
  isOpen,
  onClose,
  tenantId,
  defaultReportType = 'full',
  defaultTitle = '',
  onSuccess,
}: CreateShareModalProps) {
  const [reportType, setReportType] = useState<ShareableReportType>(defaultReportType);
  const [title, setTitle] = useState(defaultTitle || REPORT_TYPE_LABELS[defaultReportType]);
  const [description, setDescription] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<CreateShareLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          reportType,
          title,
          description: description || undefined,
          expiresInDays: expiryDays,
          password: usePassword ? password : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create share link');
      }

      const result: CreateShareLinkResponse = await response.json();
      setShareResult(result);
      onSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareResult?.shareUrl) {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setShareResult(null);
    setError(null);
    setTitle(defaultTitle || REPORT_TYPE_LABELS[defaultReportType]);
    setDescription('');
    setPassword('');
    setUsePassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-lg mx-4 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-medium text-white">
              {shareResult ? 'Share Link Created' : 'Create Share Link'}
            </h2>
            <button
              onClick={handleClose}
              className="p-1 text-white/50 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {shareResult ? (
              // Success state
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-400">Share link created successfully</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/50">Share URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareResult.shareUrl}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-white/5 rounded">
                    <div className="text-white/50 mb-1">Expires</div>
                    <div className="text-white">
                      {new Date(shareResult.expiresAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded">
                    <div className="text-white/50 mb-1">Password</div>
                    <div className="text-white">
                      {shareResult.isPasswordProtected ? 'Protected' : 'None'}
                    </div>
                  </div>
                </div>

                {shareResult.isPasswordProtected && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-200">
                    <strong>Note:</strong> Share the password separately with your accountant.
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              // Form state
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300">
                    {error}
                  </div>
                )}

                {/* Report Type */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Report Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(REPORT_TYPE_LABELS) as [ShareableReportType, string][]).map(
                      ([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setReportType(type);
                            if (!title || Object.values(REPORT_TYPE_LABELS).includes(title)) {
                              setTitle(label);
                            }
                          }}
                          className={`px-3 py-2 text-sm rounded border transition-all ${
                            reportType === type
                              ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                              : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                          }`}
                        >
                          {label.replace(' Report', '').replace(' Analysis', '')}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title for this share link"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70">
                    Description <span className="text-white/30">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a note for your accountant..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500 resize-none"
                  />
                </div>

                {/* Expiry */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Link Expires In</label>
                  <div className="flex gap-2">
                    {EXPIRY_OPTIONS.map((option) => (
                      <button
                        key={option.days}
                        type="button"
                        onClick={() => setExpiryDays(option.days)}
                        className={`px-3 py-2 text-sm rounded border transition-all ${
                          expiryDays === option.days
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password Protection */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePassword}
                      onChange={(e) => setUsePassword(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-white/70">Password protect this link</span>
                  </label>

                  {usePassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min 6 characters)"
                        minLength={6}
                        required={usePassword}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Share Link'
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CreateShareModal;
