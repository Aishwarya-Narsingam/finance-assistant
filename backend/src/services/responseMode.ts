export type ResponseMode = 'QUICK' | 'DETAILED';

const DETAILED_KEYWORDS = [
  'detail', 'detailed',
  'analysis', 'analyze', 'analytics',
  'report', 'full report', 'complete report', 'monthly report',
  'complete', 'full',
  'explain in detail', 'explain',
  'deep dive', 'deep',
  'breakdown', 'thorough',
  'comprehensive', 'in-depth',
];

/**
 * Detect whether the user wants a quick summary or a detailed analysis.
 * Default is QUICK; only return DETAILED when explicit keywords are found.
 */
export function detectResponseMode(message: string): ResponseMode {
  const cleaned = message.toLowerCase().trim();

  for (const keyword of DETAILED_KEYWORDS) {
    if (cleaned.includes(keyword)) {
      return 'DETAILED';
    }
  }

  return 'QUICK';
}
