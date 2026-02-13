/**
 * Accountant Application Validation Schemas
 *
 * Zod validation schemas for the accountant vetting workflow
 */

import { z } from 'zod';

// =====================================================
// ENUMS
// =====================================================

export const credentialTypeSchema = z.enum([
  'CPA',         // Certified Practising Accountant
  'CA',          // Chartered Accountant
  'RTA',         // Registered Tax Agent
  'BAS_AGENT',   // BAS Agent
  'FTA',         // Fellow Tax Agent
  'OTHER',       // Other professional designation
]);

export const applicationStatusSchema = z.enum([
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended',
]);

// =====================================================
// HELPER VALIDATORS
// =====================================================

/**
 * Australian phone number validation
 * Accepts: +61, 04, (02), etc.
 */
const australianPhoneSchema = z
  .string()
  .regex(
    /^(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}$/,
    'Must be a valid Australian phone number'
  )
  .optional()
  .or(z.literal(''));

/**
 * Australian Business Number (ABN) validation
 * Format: 11 digits, with optional spaces
 */
const abnSchema = z
  .string()
  .regex(
    /^[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{3}[ ]?[0-9]{3}$/,
    'ABN must be 11 digits (e.g., 51 824 753 556)'
  )
  .optional()
  .or(z.literal(''));

/**
 * URL validation with https optional
 */
const websiteSchema = z
  .string()
  .url('Must be a valid URL')
  .optional()
  .or(z.literal(''));

/**
 * Credential number validation
 * Flexible format to accommodate different issuing bodies
 */
const credentialNumberSchema = z
  .string()
  .min(3, 'Credential number must be at least 3 characters')
  .max(50, 'Credential number must be less than 50 characters')
  .regex(
    /^[A-Z0-9\-\/]+$/i,
    'Credential number must contain only letters, numbers, hyphens, and slashes'
  );

/**
 * Years of experience validation
 */
const yearsExperienceSchema = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative')
  .max(60, 'Must be less than 60 years')
  .optional();

// =====================================================
// STEP-BY-STEP FORM VALIDATION
// =====================================================

/**
 * Step 1: Personal Details
 */
export const personalDetailsSchema = z.object({
  email: z
    .string()
    .email('Must be a valid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase()
    .trim(),

  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .trim(),

  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .trim(),

  phone: australianPhoneSchema,
});

/**
 * Step 2: Firm Details
 */
export const firmDetailsSchema = z.object({
  firm_name: z
    .string()
    .min(2, 'Firm name must be at least 2 characters')
    .max(255, 'Firm name must be less than 255 characters')
    .trim(),

  firm_abn: abnSchema,

  firm_website: websiteSchema,

  firm_address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Step 3: Professional Credentials
 */
export const credentialsSchema = z.object({
  credential_type: credentialTypeSchema,

  credential_number: credentialNumberSchema,

  credential_issuing_body: z
    .string()
    .max(255, 'Issuing body must be less than 255 characters')
    .optional()
    .or(z.literal('')),

  credential_expiry: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Expiry date must be in YYYY-MM-DD format'
    )
    .refine(
      (date) => {
        const expiryDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return expiryDate >= today;
      },
      { message: 'Credential must not be expired' }
    )
    .optional()
    .or(z.literal('')),

  years_experience: yearsExperienceSchema,
});

/**
 * Step 4: Additional Information
 */
export const additionalInfoSchema = z.object({
  specializations: z
    .array(z.string().max(100))
    .max(10, 'Maximum 10 specializations allowed')
    .optional(),

  client_count: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(100000, 'Must be less than 100,000')
    .optional(),

  referral_source: z
    .string()
    .max(255, 'Referral source must be less than 255 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Step 5: Terms & Conditions
 */
export const termsSchema = z.object({
  agreed_to_terms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'You must agree to the terms and conditions',
    }),

  agreed_to_privacy: z
    .boolean()
    .refine((val) => val === true, {
      message: 'You must agree to the privacy policy',
    }),
});

// =====================================================
// FULL APPLICATION FORM SCHEMA
// =====================================================

/**
 * Complete application form validation
 * Combines all steps into single schema
 */
export const accountantApplicationFormSchema = z
  .object({
    // Step 1: Personal Details
    email: z.string().email().toLowerCase().trim(),
    first_name: z.string().min(1).max(100).trim(),
    last_name: z.string().min(1).max(100).trim(),
    phone: australianPhoneSchema,

    // Step 2: Firm Details
    firm_name: z.string().min(2).max(255).trim(),
    firm_abn: abnSchema,
    firm_website: websiteSchema,
    firm_address: z.string().max(500).optional().or(z.literal('')),

    // Step 3: Professional Credentials
    credential_type: credentialTypeSchema,
    credential_number: credentialNumberSchema,
    credential_issuing_body: z.string().max(255).optional().or(z.literal('')),
    credential_expiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('')),
    years_experience: yearsExperienceSchema,

    // Step 4: Additional Information
    specializations: z.array(z.string().max(100)).max(10).optional(),
    client_count: z.number().int().min(0).max(100000).optional(),
    referral_source: z.string().max(255).optional().or(z.literal('')),

    // Step 5: Terms
    agreed_to_terms: z.boolean().refine((val) => val === true),
    agreed_to_privacy: z.boolean().refine((val) => val === true),
  })
  .refine(
    (data) => {
      // If OTHER credential type, issuing body should be provided
      if (data.credential_type === 'OTHER' && !data.credential_issuing_body) {
        return false;
      }
      return true;
    },
    {
      message:
        'Issuing body is required when credential type is OTHER',
      path: ['credential_issuing_body'],
    }
  );

// =====================================================
// ADMIN REVIEW VALIDATION
// =====================================================

/**
 * Admin decision validation
 */
export const adminReviewDecisionSchema = z
  .object({
    application_id: z.string().uuid('Invalid application ID'),

    action: z.enum(['approve', 'reject']),

    internal_notes: z
      .string()
      .max(2000, 'Notes must be less than 2000 characters')
      .optional(),

    rejection_reason: z
      .string()
      .min(10, 'Rejection reason must be at least 10 characters')
      .max(1000, 'Rejection reason must be less than 1000 characters')
      .optional(),
  })
  .refine(
    (data) => {
      // If action is reject, rejection_reason is required
      if (data.action === 'reject' && !data.rejection_reason) {
        return false;
      }
      return true;
    },
    {
      message: 'Rejection reason is required when rejecting an application',
      path: ['rejection_reason'],
    }
  );

// =====================================================
// UPDATE VALIDATION
// =====================================================

/**
 * Partial update schema for admin modifications
 */
export const updateApplicationSchema = z
  .object({
    status: applicationStatusSchema.optional(),
    internal_notes: z.string().max(2000).optional(),
    rejection_reason: z.string().max(1000).optional(),
    reviewed_by: z.string().uuid().optional(),
    reviewed_at: z.string().datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// =====================================================
// CREDENTIAL VALIDATION RESULT
// =====================================================

/**
 * External credential verification result
 */
export const credentialValidationResultSchema = z.object({
  is_valid: z.boolean(),
  credential_type: credentialTypeSchema,
  credential_number: credentialNumberSchema,
  issuing_body: z.string().max(255).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_expired: z.boolean(),
  validation_source: z.enum(['manual', 'api', 'database']),
  validation_notes: z.string().max(1000).optional(),
});

// =====================================================
// EXPORT TYPES (inferred from schemas)
// =====================================================

export type PersonalDetails = z.infer<typeof personalDetailsSchema>;
export type FirmDetails = z.infer<typeof firmDetailsSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;
export type AdditionalInfo = z.infer<typeof additionalInfoSchema>;
export type Terms = z.infer<typeof termsSchema>;
export type AccountantApplicationForm = z.infer<
  typeof accountantApplicationFormSchema
>;
export type AdminReviewDecision = z.infer<typeof adminReviewDecisionSchema>;
export type UpdateApplication = z.infer<typeof updateApplicationSchema>;
export type CredentialValidationResult = z.infer<
  typeof credentialValidationResultSchema
>;

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Validate a single step of the form
 */
export function validateStep(
  step: number,
  data: unknown
): { success: boolean; errors?: Record<string, string[]> } {
  let schema;

  switch (step) {
    case 1:
      schema = personalDetailsSchema;
      break;
    case 2:
      schema = firmDetailsSchema;
      break;
    case 3:
      schema = credentialsSchema;
      break;
    case 4:
      schema = additionalInfoSchema;
      break;
    case 5:
      schema = termsSchema;
      break;
    default:
      return {
        success: false,
        errors: { _form: ['Invalid step number'] },
      };
  }

  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true };
  } else {
    const errors: Record<string, string[]> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(err.message);
    });
    return { success: false, errors };
  }
}

/**
 * Validate the complete form
 */
export function validateFullApplication(
  data: unknown
): { success: boolean; errors?: Record<string, string[]> } {
  const result = accountantApplicationFormSchema.safeParse(data);

  if (result.success) {
    return { success: true };
  } else {
    const errors: Record<string, string[]> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(err.message);
    });
    return { success: false, errors };
  }
}

/**
 * Sanitise form data before submission
 * Removes empty strings and normalises values
 */
export function sanitiseFormData(data: AccountantApplicationForm): AccountantApplicationForm {
  return {
    ...data,
    phone: data.phone === '' ? undefined : data.phone,
    firm_abn: data.firm_abn === '' ? undefined : data.firm_abn,
    firm_website: data.firm_website === '' ? undefined : data.firm_website,
    firm_address: data.firm_address === '' ? undefined : data.firm_address,
    credential_issuing_body:
      data.credential_issuing_body === ''
        ? undefined
        : data.credential_issuing_body,
    credential_expiry:
      data.credential_expiry === '' ? undefined : data.credential_expiry,
    referral_source:
      data.referral_source === '' ? undefined : data.referral_source,
  };
}
