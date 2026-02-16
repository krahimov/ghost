/**
 * Rough token count estimation.
 * Uses the ~4 chars per token heuristic for English text.
 * Good enough for threshold comparisons — not for billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
