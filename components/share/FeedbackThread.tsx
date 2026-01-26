'use client';

/**
 * FeedbackThread
 *
 * Displays a thread of feedback items with nested replies.
 * Supports expanding replies and adding new responses.
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedbackWithReplies, FeedbackType } from '@/lib/types/share-feedback';
import { FEEDBACK_TYPE_CONFIG, formatFeedbackTime } from '@/lib/types/share-feedback';
import { FeedbackForm } from './FeedbackForm';

interface FeedbackThreadProps {
  feedback: FeedbackWithReplies[];
  token: string;
  findingId?: string;
  onNewFeedback?: () => void;
  showAddForm?: boolean;
}

export function FeedbackThread({
  feedback,
  token,
  findingId,
  onNewFeedback,
  showAddForm = true,
}: FeedbackThreadProps) {
  const [showForm, setShowForm] = useState(false);

  if (feedback.length === 0 && !showAddForm) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Existing Feedback */}
      {feedback.length > 0 && (
        <div className="space-y-3">
          {feedback.map((item) => (
            <FeedbackItem
              key={item.id}
              item={item}
              token={token}
              onReply={onNewFeedback}
            />
          ))}
        </div>
      )}

      {/* Add Feedback Button/Form */}
      {showAddForm && (
        <div>
          {showForm ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FeedbackForm
                token={token}
                findingId={findingId}
                onSubmit={async () => {
                  onNewFeedback?.();
                  setShowForm(false);
                }}
                onCancel={() => setShowForm(false)}
                compact
              />
            </motion.div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Feedback
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FeedbackItemProps {
  item: FeedbackWithReplies;
  token: string;
  onReply?: () => void;
  depth?: number;
}

function FeedbackItem({ item, token, onReply, depth = 0 }: FeedbackItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const config = FEEDBACK_TYPE_CONFIG[item.feedback_type as FeedbackType];

  const hasReplies = item.replies && item.replies.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l border-white/10' : ''}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <span className="font-medium text-white">{item.author_name}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <span className="text-xs text-white/40">
            {formatFeedbackTime(item.created_at)}
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-white/80 whitespace-pre-wrap">{item.message}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Reply
          </button>
          {hasReplies && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Reply Form */}
        <AnimatePresence>
          {showReplyForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-white/10"
            >
              <FeedbackForm
                token={token}
                replyTo={item.id}
                onSubmit={async () => {
                  onReply?.();
                  setShowReplyForm(false);
                }}
                onCancel={() => setShowReplyForm(false)}
                compact
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Nested Replies */}
      <AnimatePresence>
        {expanded && hasReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-3"
          >
            {item.replies.map((reply) => (
              <FeedbackItem
                key={reply.id}
                item={reply}
                token={token}
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FeedbackThread;
