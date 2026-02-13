'use client';

/**
 * Accountant Application Form Component
 *
 * Multi-step wizard for accountants to apply for wholesale pricing
 * Steps:
 * 1. Personal Details
 * 2. Firm Details
 * 3. Professional Credentials
 * 4. Additional Information
 * 5. Terms & Conditions
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type AccountantApplicationForm,
  validateStep,
  sanitiseFormData,
} from '@/lib/validation/accountant-application';
import type { CredentialType } from '@/lib/types/accountant';

interface ApplicationFormProps {
  onSuccess?: (applicationId: string) => void;
  onCancel?: () => void;
}

const CREDENTIAL_TYPES: { value: CredentialType; label: string; description: string }[] = [
  { value: 'CPA', label: 'CPA', description: 'Certified Practising Accountant' },
  { value: 'CA', label: 'CA', description: 'Chartered Accountant' },
  { value: 'RTA', label: 'RTA', description: 'Registered Tax Agent' },
  { value: 'BAS_AGENT', label: 'BAS Agent', description: 'BAS Agent' },
  { value: 'FTA', label: 'FTA', description: 'Fellow Tax Agent' },
  { value: 'OTHER', label: 'Other', description: 'Other professional designation' },
];

const SPECIALIZATIONS = [
  'R&D Tax Incentive',
  'Corporate Tax',
  'Trust Structures',
  'Division 7A',
  'Tax Losses',
  'Fringe Benefits Tax',
  'Payroll Tax',
  'GST & BAS',
  'Capital Gains Tax',
  'International Tax',
  'Self-Managed Super Funds',
  'Business Advisory',
];

export default function ApplicationForm({ onSuccess, onCancel }: ApplicationFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Form state
  const [formData, setFormData] = useState<Partial<AccountantApplicationForm>>({
    // Step 1: Personal Details
    email: '',
    first_name: '',
    last_name: '',
    phone: '',

    // Step 2: Firm Details
    firm_name: '',
    firm_abn: '',
    firm_website: '',
    firm_address: '',

    // Step 3: Professional Credentials
    credential_type: 'CPA',
    credential_number: '',
    credential_issuing_body: '',
    credential_expiry: '',
    years_experience: undefined,

    // Step 4: Additional Information
    specializations: [],
    client_count: undefined,
    referral_source: '',

    // Step 5: Terms
    agreed_to_terms: false,
    agreed_to_privacy: false,
  });

  const updateFormData = (field: string, value: string | number | boolean | string[] | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors for this field
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const validateCurrentStep = (): boolean => {
    const result = validateStep(currentStep, formData);
    if (!result.success && result.errors) {
      setErrors(result.errors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const sanitizedData = sanitiseFormData(formData as AccountantApplicationForm);

      const response = await fetch('/api/accountant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ _form: [data.error || data.message || 'Failed to submit application'] });
        }
        return;
      }

      // Success
      if (onSuccess) {
        onSuccess(data.application_id);
      } else {
        router.push(`/accountant/application/${data.application_id}?success=true`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setErrors({ _form: ['Network error. Please try again.'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSpecialization = (spec: string) => {
    const current = formData.specializations || [];
    if (current.includes(spec)) {
      updateFormData('specializations', current.filter((s) => s !== spec));
    } else {
      updateFormData('specializations', [...current, spec]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`flex-1 text-center text-sm font-medium ${
                step === currentStep
                  ? 'text-blue-600'
                  : step < currentStep
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}
            >
              Step {step}
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Form Errors */}
      {errors._form && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errors._form[0]}</p>
        </div>
      )}

      {/* Step 1: Personal Details */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Personal Details</h2>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="your.email@firm.com.au"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email[0]}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => updateFormData('first_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.first_name[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => updateFormData('last_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.last_name[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone Number (Optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateFormData('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="+61 4XX XXX XXX"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone[0]}</p>}
          </div>
        </div>
      )}

      {/* Step 2: Firm Details */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Firm Details</h2>

          <div>
            <label className="block text-sm font-medium mb-2">
              Firm Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.firm_name}
              onChange={(e) => updateFormData('firm_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {errors.firm_name && (
              <p className="mt-1 text-sm text-red-600">{errors.firm_name[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ABN (Optional)</label>
            <input
              type="text"
              value={formData.firm_abn}
              onChange={(e) => updateFormData('firm_abn', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="51 824 753 556"
            />
            {errors.firm_abn && <p className="mt-1 text-sm text-red-600">{errors.firm_abn[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Website (Optional)</label>
            <input
              type="url"
              value={formData.firm_website}
              onChange={(e) => updateFormData('firm_website', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://your-firm.com.au"
            />
            {errors.firm_website && (
              <p className="mt-1 text-sm text-red-600">{errors.firm_website[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address (Optional)</label>
            <textarea
              value={formData.firm_address}
              onChange={(e) => updateFormData('firm_address', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="123 Collins St, Melbourne VIC 3000"
            />
            {errors.firm_address && (
              <p className="mt-1 text-sm text-red-600">{errors.firm_address[0]}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Professional Credentials */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Professional Credentials</h2>

          <div>
            <label className="block text-sm font-medium mb-2">
              Credential Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.credential_type}
              onChange={(e) => updateFormData('credential_type', e.target.value as CredentialType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {CREDENTIAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
            {errors.credential_type && (
              <p className="mt-1 text-sm text-red-600">{errors.credential_type[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Credential Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.credential_number}
              onChange={(e) => updateFormData('credential_number', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 12345678"
            />
            {errors.credential_number && (
              <p className="mt-1 text-sm text-red-600">{errors.credential_number[0]}</p>
            )}
          </div>

          {formData.credential_type === 'OTHER' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Issuing Body <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.credential_issuing_body}
                onChange={(e) => updateFormData('credential_issuing_body', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., CPA Australia, CA ANZ"
              />
              {errors.credential_issuing_body && (
                <p className="mt-1 text-sm text-red-600">{errors.credential_issuing_body[0]}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Expiry Date (Optional)</label>
              <input
                type="date"
                value={formData.credential_expiry}
                onChange={(e) => updateFormData('credential_expiry', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {errors.credential_expiry && (
                <p className="mt-1 text-sm text-red-600">{errors.credential_expiry[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Years Experience (Optional)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={formData.years_experience || ''}
                onChange={(e) =>
                  updateFormData('years_experience', e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {errors.years_experience && (
                <p className="mt-1 text-sm text-red-600">{errors.years_experience[0]}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Additional Information */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Additional Information</h2>

          <div>
            <label className="block text-sm font-medium mb-3">Specializations (Optional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SPECIALIZATIONS.map((spec) => (
                <label key={spec} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.specializations?.includes(spec)}
                    onChange={() => toggleSpecialization(spec)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">{spec}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Approximate Client Count (Optional)
            </label>
            <input
              type="number"
              min="0"
              value={formData.client_count || ''}
              onChange={(e) =>
                updateFormData('client_count', e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {errors.client_count && (
              <p className="mt-1 text-sm text-red-600">{errors.client_count[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">How did you hear about us?</label>
            <input
              type="text"
              value={formData.referral_source}
              onChange={(e) => updateFormData('referral_source', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., LinkedIn, Google, Referral from colleague"
            />
          </div>
        </div>
      )}

      {/* Step 5: Terms & Conditions */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6">Terms & Conditions</h2>

          <div className="space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.agreed_to_terms}
                onChange={(e) => updateFormData('agreed_to_terms', e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                  Terms and Conditions
                </a>{' '}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.agreed_to_terms && (
              <p className="ml-7 text-sm text-red-600">{errors.agreed_to_terms[0]}</p>
            )}

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.agreed_to_privacy}
                onChange={(e) => updateFormData('agreed_to_privacy', e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm">
                I agree to the{' '}
                <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>{' '}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.agreed_to_privacy && (
              <p className="ml-7 text-sm text-red-600">{errors.agreed_to_privacy[0]}</p>
            )}
          </div>

          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
              <li>Your application will be reviewed within 24-48 hours</li>
              <li>We'll verify your credentials with the issuing body</li>
              <li>Once approved, you'll receive a welcome email with login details</li>
              <li>You'll have instant access to wholesale pricing ($495 vs $995)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isSubmitting}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Previous
          </button>
        )}

        {currentStep < 5 && (
          <button
            type="button"
            onClick={handleNext}
            className="ml-auto px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Next
          </button>
        )}

        {currentStep === 5 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="ml-auto px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </button>
        )}
      </div>

      {onCancel && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
