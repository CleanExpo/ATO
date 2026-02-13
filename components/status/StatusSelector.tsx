'use client';

/**
 * StatusSelector
 *
 * Dropdown to change recommendation status.
 * Shows only valid transitions based on updater type.
 *
 * Scientific Luxury design system.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecommendationStatus, UpdaterType } from '@/lib/types/recommendation-status';
import {
  STATUS_CONFIG,
  getValidTransitions,
  getAvailableStatuses,
} from '@/lib/types/recommendation-status';
import { StatusBadge } from './StatusBadge';

interface StatusSelectorProps {
  currentStatus: RecommendationStatus;
  updaterType: UpdaterType;
  onStatusChange: (status: RecommendationStatus, notes?: string) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function StatusSelector({
  currentStatus,
  updaterType,
  onStatusChange,
  disabled = false,
  compact = false,
  className = '',
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RecommendationStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get valid transitions from current status
  const validTransitions = getValidTransitions(currentStatus, updaterType);
  const availableStatuses = getAvailableStatuses(updaterType);

  // For selector, show valid transitions + current status
  const selectableStatuses = [
    currentStatus,
    ...validTransitions.filter((s) => s !== currentStatus),
  ];

  const handleSelect = async (status: RecommendationStatus) => {
    if (status === currentStatus) {
      setIsOpen(false);
      return;
    }

    // For statuses that typically need explanation
    const needsNotes = ['needs_clarification', 'rejected', 'needs_verification'].includes(status);

    if (needsNotes) {
      setSelectedStatus(status);
    } else {
      setIsSubmitting(true);
      try {
        await onStatusChange(status);
        setIsOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitWithNotes = async () => {
    if (!selectedStatus) return;

    setIsSubmitting(true);
    try {
      await onStatusChange(selectedStatus, notes.trim() || undefined);
      setSelectedStatus(null);
      setNotes('');
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedStatus(null);
    setNotes('');
    setIsOpen(false);
  };

  if (disabled || selectableStatuses.length <= 1) {
    return <StatusBadge status={currentStatus} size={compact ? 'sm' : 'md'} className={className} />;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSubmitting}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        <StatusBadge status={currentStatus} size={compact ? 'sm' : 'md'} animate={false} />
        <svg
          className={`w-3 h-3 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && !selectedStatus && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 z-50 min-w-[180px]"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
              {selectableStatuses.map((status) => {
                const config = STATUS_CONFIG[status];
                const isCurrent = status === currentStatus;

                return (
                  <button
                    key={status}
                    onClick={() => handleSelect(status)}
                    disabled={isSubmitting}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                      ${isCurrent ? 'bg-white/5' : 'hover:bg-white/5'}
                      ${config.color}
                    `}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                    {isCurrent && (
                      <span className="ml-auto text-xs text-white/30">Current</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Notes Dialog */}
        {selectedStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl"
            >
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{STATUS_CONFIG[selectedStatus].icon}</span>
                  <h3 className="text-lg font-medium text-white">
                    Change to {STATUS_CONFIG[selectedStatus].label}
                  </h3>
                </div>
                <p className="text-sm text-white/50 mt-1">
                  {STATUS_CONFIG[selectedStatus].description}
                </p>
              </div>

              <div className="p-4">
                <label className="block text-xs text-white/50 mb-2">
                  Add notes {selectedStatus === 'needs_clarification' && '(required)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    selectedStatus === 'needs_clarification'
                      ? 'What clarification is needed?'
                      : selectedStatus === 'rejected'
                      ? 'Why is this being rejected?'
                      : 'Add optional notes...'
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-end gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitWithNotes}
                  disabled={isSubmitting || (selectedStatus === 'needs_clarification' && !notes.trim())}
                  className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StatusSelector;
