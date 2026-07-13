export const RARE_EVIDENCE_DISCLOSURE_THRESHOLD = 34;

export function hasObservableRareEvidence(rareEvidence: number): boolean {
  return rareEvidence >= RARE_EVIDENCE_DISCLOSURE_THRESHOLD;
}
