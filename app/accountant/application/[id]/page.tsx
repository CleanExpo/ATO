/**
 * Application Status Page
 *
 * Shows the status of a submitted accountant application
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ApplicationStatusCard from '@/components/accountant/ApplicationStatusCard';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}

export const metadata = {
  title: 'Application Status | Australian Tax Optimizer',
  description: 'Check the status of your accountant application.',
};

async function StatusContent({ applicationId, showSuccess }: { applicationId: string; showSuccess: boolean }) {
  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(applicationId)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Success Message */}
      {showSuccess && (
        <div className="max-w-3xl mx-auto mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h2 className="text-xl font-semibold text-green-900">
                Application Submitted Successfully!
              </h2>
              <p className="text-green-800 mt-1">
                Thank you for applying. We'll review your application within 24-48 hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Status</h1>
        <p className="text-gray-600">
          Track the progress of your accountant application below
        </p>
      </div>

      {/* Status Card */}
      <ApplicationStatusCard applicationId={applicationId} autoRefresh={true} />

      {/* Help Section */}
      <div className="max-w-3xl mx-auto mt-12 text-center">
        <p className="text-gray-600 mb-4">Need help or have questions?</p>
        <a
          href="mailto:accountants@ato.example.com"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}

export default async function ApplicationStatusPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { success } = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
          </div>
        </div>
      }
    >
      <StatusContent applicationId={id} showSuccess={success === 'true'} />
    </Suspense>
  );
}
