'use client';

/**
 * FeedbackForm
 *
 * Form for accountants to submit feedback on shared reports.
 * Supports different feedback types and optional email.
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedbackType, CreateFeedbackRequest } from '@/lib/types/share-feedback';
import { FEEDBACK_TYPE_CONFIG } from '@/lib/types/share-feedback';

interface FeedbackFormProps {
  token: string;
  findingId?: string;
  replyTo?: string;
  onSubmit?: (feedback: CreateFeedbackRequest) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}

export function FeedbackForm({
  token,
  findingId,
  replyTo,
  onSubmit,
  onCancel,
  compact = false,
}: FeedbackFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('comment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateFeedbackRequest = {
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
        message: message.trim(),
        feedbackType,
        findingId,
        replyTo,
      };

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        // Direct API call
        const response = await fetch(`/api/share/${token}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to submit feedback');
        }
      }

      setSuccess(true);
      setMessage('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
      >
        <div className="flex items-center gap-3 text-green-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Feedback submitted successfully!</span>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Feedback Type */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(FEEDBACK_TYPE_CONFIG) as [FeedbackType, typeof FEEDBACK_TYPE_CONFIG['comment']][]).map(
          ([type, config]) => (
            <button
              key={type}
              type="button"
              onClick={() => setFeedbackType(type)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                feedbackType === type
                  ? `${config.bgColor} ${config.borderColor} ${config.color}`
                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
              }`}
            >
              <span className="mr-1.5">{config.icon}</span>
              {config.label}
            </button>
          )
        )}
      </div>

      {/* Author Info */}
      <div className={compact ? 'flex gap-3' : 'grid grid-cols-2 gap-3'}>
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1.5">Your Name *</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Enter your name"
            required
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1.5">Email (optional)</label>
          <input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            feedbackType === 'question'
              ? 'What would you like to know?'
              : feedbackType === 'concern'
              ? 'Please describe your concern...'
              : feedbackType === 'approval'
              ? 'Add any notes about this approval...'
              : 'Share your feedback...'
          }
          required
          rows={compact ? 2 : 3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !authorName.trim() || !message.trim()}
          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default FeedbackForm;
