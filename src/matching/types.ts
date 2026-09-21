/** A piece of Candidate Evidence (CONTEXT.md) flattened to plain text for
 * matching, plus enough provenance to cite it back to the user. Only ever
 * built from `verified: true` records — CONTEXT.md's Candidate Evidence
 * definition is explicit that unverified evidence can't back a match. */
export interface EvidenceItem {
  type: 'skill' | 'experience' | 'education' | 'certification' | 'project' | 'achievement';
  text: string;
}

/** One verified Experience entry, kept separate from `EvidenceItem` because
 * `experience`-category Requirements need its duration and per-entry
 * relevance, not just its text. */
export interface ExperienceEvidence {
  label: string;
  text: string;
  years: number;
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
  /** null when there isn't enough to score against — reporting 0 or 100 off
   * one or two Requirements would manufacture a number PRD §31 explicitly
   * warns against ("do not manufacture confidence"). `scoreNote` says why. */
  score: number | null;
  scoreNote: string | null;
  reasons: MatchReason[];
  gaps: MatchGap[];
}
