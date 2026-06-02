/**
 * Deterministic LCG used by the QA harness and by tests that need a
 * reproducible roll/part sequence. One copy so a constant change can't make
 * the harness and the tests disagree.
 */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
