/**
 * /onboarding
 *
 * Renders the SMB Onboarding Wizard.
 * After plan purchase, Stripe redirects to /dashboard?payment=success.
 */

import { SMBOnboardingWizard } from '@/components/onboarding/SMBOnboardingWizard'

export const metadata = {
  title: 'Get Started — ATO Tax Optimizer',
  description: 'Set up your organisation and choose a plan.',
}

export default function OnboardingPage() {
  return <SMBOnboardingWizard />
}
