/** A piece of Candidate Evidence (CONTEXT.md) flattened to plain text for
 * matching, plus enough provenance to cite it back to the user. Only ever
 * built from `verified: true` records — CONTEXT.md's Candidate Evidence
 * definition is explicit that unverified evidence can't back a match. */
export interface EvidenceItem {
  type: 'skill' | 'experience' | 'education' | 'certification' | 'project' | 'achievement';
  text: string;
}

export interface MatchReason {
  requirementId: string;
  category: string;
  requirement: string;
  evidence: string;
  evidenceType: EvidenceItem['type'] | 'experience_duration';
  confidence: 'high' | 'medium';
}

export interface MatchGap {
  requirementId: string;
  category: string;
  requirement: string;
}

export interface MatchScoreResult {
  excluded: boolean;
  exclusionReason: string | null;
  /** null when the posting has no extracted Requirements to score against —
   * reporting 0 or 100 in that case would manufacture a number PRD §31
   * explicitly warns against ("do not manufacture confidence"). */
  score: number | null;
  reasons: MatchReason[];
  gaps: MatchGap[];
}
