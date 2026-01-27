/**
 * Evidence Guidance Content
 *
 * Guidance content for each element of the Division 355 four-element test.
 * Provides descriptions, examples, and suggested documents to help users
 * collect appropriate evidence for their R&D claims.
 *
 * Division 355 ITAA 1997 - R&D Tax Incentive
 */

import { type EvidenceElement } from '@/lib/types/rnd-evidence'

/**
 * Guidance content for a single element
 */
export interface EvidenceElementGuidance {
  description: string
  examples: string[]
  suggestedDocuments: string[]
  atoGuidance?: string
  warningNotes?: string[]
}

/**
 * Evidence guidance for all four elements of the Division 355 test
 */
export const EVIDENCE_GUIDANCE: Record<EvidenceElement, EvidenceElementGuidance> = {
  /**
   * Element 1: Outcome Unknown
   *
   * Evidence that the outcome of the R&D activity could not be determined
   * in advance on the basis of current knowledge, information, or experience.
   * s 355-25(1)(a) ITAA 1997
   */
  outcome_unknown: {
    description:
      'Evidence demonstrating that the outcome of your R&D activities could not be determined ' +
      'in advance based on existing knowledge, information, or experience. You must show that ' +
      'at the start of the project, there was genuine uncertainty about whether your approach ' +
      'would achieve the desired outcome.',

    examples: [
      'Documentation of knowledge gaps identified at project inception',
      'Records of hypotheses formed before experiments began',
      'Technical feasibility assessments showing uncertainty',
      'Expert opinions confirming unknowns in the field',
      'Literature reviews demonstrating gaps in existing knowledge',
      'Meeting minutes discussing technical uncertainties',
      'Emails or messages documenting questions without known answers',
      'Comparison with competitors showing no existing solution',
    ],

    suggestedDocuments: [
      'Project initiation document with stated uncertainties',
      'Technical feasibility study or scoping document',
      'Literature review or prior art search',
      'Meeting minutes from project planning sessions',
      'Expert consultation reports or opinions',
      'Technical risk assessment documents',
      'Hypothesis statements documented before experimentation',
      'Market research showing no existing solutions',
    ],

    atoGuidance:
      'The ATO requires evidence that genuine technical uncertainty existed at the start of ' +
      'the R&D activity. Routine engineering or software development with predictable outcomes ' +
      'does not qualify. Focus on documenting what you did not know, not just what you did.',

    warningNotes: [
      'Hindsight evidence created after the project is less valuable',
      'General business uncertainty (market, cost, schedule) is not sufficient',
      'The uncertainty must be scientific or technical in nature',
    ],
  },

  /**
   * Element 2: Systematic Approach
   *
   * Evidence that the R&D activities were conducted using a systematic
   * progression of work based on principles of established science.
   * s 355-25(1)(b) ITAA 1997
   */
  systematic_approach: {
    description:
      'Evidence showing that your R&D activities followed a systematic progression of work ' +
      'based on principles of established science. This means documenting a logical series of ' +
      'steps: forming hypotheses, designing experiments or tests, conducting those tests, ' +
      'recording observations, and reaching conclusions.',

    examples: [
      'Project plans with defined methodology and milestones',
      'Experiment or test plans with clear objectives',
      'Lab notebooks or technical journals with dated entries',
      'Version control history showing iterative development',
      'Test protocols and procedures documentation',
      'Progress reports showing systematic investigation',
      'Peer review records and technical discussions',
      'Failure analysis documents showing learning from tests',
    ],

    suggestedDocuments: [
      'Project plan or methodology document',
      'Technical specifications and design documents',
      'Lab notebooks or engineering journals',
      'Test plans and test case documentation',
      'Sprint retrospectives or iteration reviews',
      'Technical review meeting minutes',
      'Version control commit logs with meaningful messages',
      'Quality assurance and testing protocols',
    ],

    atoGuidance:
      'The ATO looks for evidence of a methodical approach following scientific or technical ' +
      'principles. Random trial-and-error without documented reasoning does not qualify. ' +
      'Show that each step was planned based on principles of science.',

    warningNotes: [
      'Ad-hoc experimentation without planning may not qualify',
      'The systematic approach must be documented, not just verbal',
      'Copying existing solutions with minor tweaks is not systematic R&D',
    ],
  },

  /**
   * Element 3: New Knowledge
   *
   * Evidence that the R&D activities generated new knowledge about
   * resolving a scientific or technical uncertainty.
   * s 355-25(1)(c) ITAA 1997
   */
  new_knowledge: {
    description:
      'Evidence that your R&D activities generated new knowledge - that is, knowledge that ' +
      'did not previously exist and could not be deduced by a competent professional in the ' +
      'relevant field. This includes knowledge about what does not work (negative knowledge) ' +
      'as well as successful outcomes.',

    examples: [
      'Technical reports documenting findings and conclusions',
      'Patents or patent applications filed from R&D',
      'Publications or conference presentations',
      'Internal knowledge base articles created from R&D',
      'Training materials developed from new findings',
      'Technical specifications that evolved during R&D',
      'Documented failed approaches and lessons learned',
      'Novel algorithms, formulas, or techniques developed',
    ],

    suggestedDocuments: [
      'Technical findings report or R&D completion report',
      'Patent applications or invention disclosures',
      'Published papers or conference submissions',
      'Internal technical documentation of new methods',
      'Lessons learned documents',
      'Updated technical specifications showing evolution',
      'Training materials based on R&D findings',
      'Comparison of before/after capabilities',
    ],

    atoGuidance:
      'New knowledge must be genuinely new - not just new to your organisation but new to the ' +
      'field. A competent professional should not have been able to determine this knowledge ' +
      'without conducting similar R&D. Document what you learned that was previously unknown.',

    warningNotes: [
      'Routine adaptation of existing knowledge does not qualify',
      'Knowledge gained must be technical/scientific, not business knowledge',
      'Failed experiments still generate new knowledge if documented',
    ],
  },

  /**
   * Element 4: Scientific Method
   *
   * Evidence that the R&D activities were conducted using principles
   * of established science, engineering, or computer science.
   * s 355-25(1)(d) ITAA 1997
   */
  scientific_method: {
    description:
      'Evidence that your R&D activities used established scientific, engineering, or computer ' +
      'science principles. This includes using recognised methodologies, applying mathematical ' +
      'or physical laws, following engineering standards, or using established software ' +
      'development principles.',

    examples: [
      'References to scientific or engineering standards used',
      'Mathematical models or simulations applied',
      'Engineering calculations and analysis',
      'Software architecture documents following best practices',
      'Statistical analysis of experimental results',
      'Calibration and measurement records',
      'Peer review by qualified professionals',
      'Technical certifications or qualifications of staff involved',
    ],

    suggestedDocuments: [
      'Technical design documents citing standards',
      'Mathematical models and calculations',
      'Simulation results and validation data',
      'Engineering analysis reports',
      'Statistical analysis of test results',
      'Calibration certificates for equipment used',
      'Staff qualifications and CVs of key researchers',
      'References to scientific literature applied',
    ],

    atoGuidance:
      'The ATO requires that R&D be conducted using principles of established science - this ' +
      'includes natural sciences, engineering, mathematics, and computer science. Intuition, ' +
      'business acumen, or artistic creativity alone do not satisfy this element.',

    warningNotes: [
      'Social sciences and humanities generally do not qualify',
      'Market research and surveys are not scientific R&D',
      'The scientific principles must be genuinely applied, not just referenced',
    ],
  },
}

/**
 * Get guidance for a specific element
 */
export function getEvidenceGuidance(element: EvidenceElement): EvidenceElementGuidance {
  return EVIDENCE_GUIDANCE[element]
}

/**
 * Get all guidance as array for iteration
 */
export function getAllEvidenceGuidance(): Array<{
  element: EvidenceElement
  guidance: EvidenceElementGuidance
}> {
  return Object.entries(EVIDENCE_GUIDANCE).map(([element, guidance]) => ({
    element: element as EvidenceElement,
    guidance,
  }))
}

/**
 * Check if an element has strong evidence based on count
 */
export function hasStrongEvidence(evidenceCount: number): boolean {
  return evidenceCount >= 5
}

/**
 * Check if an element has adequate evidence based on count
 */
export function hasAdequateEvidence(evidenceCount: number): boolean {
  return evidenceCount >= 3
}

/**
 * Get evidence recommendation based on current count
 */
export function getEvidenceRecommendation(element: EvidenceElement, evidenceCount: number): string {
  if (evidenceCount === 0) {
    return `No evidence collected for ${EVIDENCE_GUIDANCE[element].description.split('.')[0].toLowerCase()}. Start by adding documentation.`
  }

  if (evidenceCount < 3) {
    return `Add ${3 - evidenceCount} more evidence items to reach adequate coverage for this element.`
  }

  if (evidenceCount < 5) {
    return `Good progress. Add ${5 - evidenceCount} more items for strong evidence coverage.`
  }

  return 'Strong evidence coverage. Consider reviewing for quality and contemporaneity.'
}

export default EVIDENCE_GUIDANCE
