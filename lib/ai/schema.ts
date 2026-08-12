import { z } from 'zod';

/**
 * The advisor's output contract, in two representations that must stay in step:
 *
 *  - a **Zod schema**, used to validate what the model actually sent back;
 *  - a **JSON Schema**, sent with the request so the provider constrains generation.
 *
 * They are adjacent in one file deliberately. Kept apart they drift, and a drift here is not a
 * type error — it is a report that renders with a missing field at 2am.
 *
 * The JSON Schema is HAND-WRITTEN rather than generated. Generators emit `minLength`, `maxItems`
 * and optional properties by default, and DeepSeek's strict mode rejects all of them; worse, the
 * rejection only surfaces at request time, so a generated schema looks fine until it costs a call
 * to discover otherwise. The rules, which this file follows exactly:
 *
 *   - every property listed in `required`
 *   - `additionalProperties: false` on every object
 *   - no minLength / maxLength / minItems / maxItems anywhere
 *
 * The consequence is that NOTHING can be optional. "No affected paths" is an empty array, never a
 * missing key; "nothing to flag" is an empty dataGaps array. Absence is always modelled as an
 * explicit empty value or an enum member.
 */

export const CATEGORIES = [
  'content',
  'technical_seo',
  'acquisition',
  'engagement'
] as const;

export const PRIORITIES = ['high', 'medium', 'low'] as const;

export const ASSESSMENTS = ['healthy', 'needs_attention', 'critical'] as const;

export const recommendationSchema = z.object({
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  finding: z.string().min(1),
  /**
   * The honesty mechanism. Every recommendation must quote the specific figure or page signal it
   * rests on, drawn from the supplied payload — and the UI renders it inline rather than behind a
   * toggle, because a claim the reader cannot check is a claim they should not act on.
   */
  evidence: z.string().min(1),
  action: z.string().min(1),
  /** Empty array when the recommendation is site-wide. Never absent. */
  affectedPaths: z.array(z.string())
});

export const analysisSchema = z.object({
  summary: z.string().min(1),
  overallAssessment: z.enum(ASSESSMENTS),
  recommendations: z.array(recommendationSchema),
  /** Questions the collected data cannot answer. Empty array is valid. */
  dataGaps: z.array(z.string())
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type Analysis = z.infer<typeof analysisSchema>;

/** The tool the model is offered. Exactly one, and its description says it must be called. */
export const ANALYSIS_TOOL_NAME = 'submit_analysis';

export const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'overallAssessment', 'recommendations', 'dataGaps'],
  properties: {
    summary: {
      type: 'string',
      description:
        'Two or three sentences on where this site stands, referring only to figures present in the supplied data.'
    },
    overallAssessment: {
      type: 'string',
      enum: [...ASSESSMENTS],
      description:
        'healthy when nothing needs urgent attention; needs_attention for fixable problems; critical when traffic or indexability is materially at risk.'
    },
    recommendations: {
      type: 'array',
      description:
        'Between three and six recommendations, ordered most important first. Prefer fewer grounded recommendations over a padded list.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'category',
          'priority',
          'finding',
          'evidence',
          'action',
          'affectedPaths'
        ],
        properties: {
          title: {
            type: 'string',
            description: 'A short imperative, e.g. "Add a meta description to /pricing".'
          },
          category: { type: 'string', enum: [...CATEGORIES] },
          priority: { type: 'string', enum: [...PRIORITIES] },
          finding: { type: 'string', description: 'What the data shows.' },
          evidence: {
            type: 'string',
            description:
              'The exact figure or page signal this rests on, quoted from the supplied data. Never estimate, interpolate or invent a number. If you cannot quote something supplied, do not make the recommendation.'
          },
          action: { type: 'string', description: 'The concrete change to make.' },
          affectedPaths: {
            type: 'array',
            description:
              'Paths this applies to, drawn from the supplied pages. Use an empty array when it is site-wide.',
            items: { type: 'string' }
          }
        }
      }
    },
    dataGaps: {
      type: 'array',
      description:
        'Questions a reader might reasonably ask that this data cannot answer. Empty array if none.',
      items: { type: 'string' }
    }
  }
} as const;
