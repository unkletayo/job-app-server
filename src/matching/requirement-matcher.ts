import { Requirement } from '@prisma/client';
import { EvidenceItem, MatchGap, MatchReason } from './types';

const STOPWORDS = new Set([
  'with', 'and', 'the', 'for', 'from', 'that', 'this', 'have', 'will', 'your',
  'you', 'our', 'are', 'was', 'were', 'into', 'their', 'they', 'able', 'across',
]);

const YEARS_PATTERN = /(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?\+?\s*years?/i;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function significantWords(text: string): string[] {
  // >= 3, not > 3 — real stopwords of that length ("the", "and", "for"...)
  // are excluded by name above, so this is safe, and it's what lets a
  // short brand-name acronym (AWS, PMP) count as a shared word.
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function containsWholeWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);
}

/** Bidirectional whole-word/substring match — used for short, atomic
 * requirement text (a skill name, a keyword, a certification) where either
 * side could be the more specific string ("python" in "Python, Go" or
 * "AWS Certified Solutions Architect" containing "AWS certification"). */
function shortTextMatches(requirementText: string, evidenceText: string): boolean {
  const req = normalize(requirementText);
  const evidence = normalize(evidenceText);
  return containsWholeWord(evidence, req) || containsWholeWord(req, evidence);
}

/** Word-overlap match — used for sentence-length requirement text
 * (responsibilities, education) where bidirectional containment rarely
 * lines up. Deterministic, not semantic: shared significant words only,
 * no synonym/embedding matching (0003-deterministic-first-matching). */
function wordOverlapMatches(requirementText: string, evidenceText: string): boolean {
  const words = significantWords(requirementText);
  const evidence = normalize(evidenceText);
  return words.some((word) => containsWholeWord(evidence, word));
}

function parseRequiredYears(requirementText: string): number | null {
  const match = requirementText.match(YEARS_PATTERN);
  return match ? Number(match[1]) : null;
}

/**
 * Matches a Job Posting's extracted Requirements (ticket 06) against the
 * candidate's verified Evidence (CONTEXT.md), per
 * 0003-deterministic-first-matching — keyword/word-overlap only, no
 * embeddings. `experienceYears` is the candidate's total verified years of
 * work experience (summed elsewhere from Experience date ranges), used
 * specifically for `experience`-category Requirements, which ticket 06's
 * extractor only ever produces from a "N years ... experience" pattern.
 */
export function matchRequirements(
  requirements: Requirement[],
  evidence: EvidenceItem[],
  experienceYears: number,
): { reasons: MatchReason[]; gaps: MatchGap[] } {
  const reasons: MatchReason[] = [];
  const gaps: MatchGap[] = [];

  for (const requirement of requirements) {
    if (requirement.category === 'experience') {
      const requiredYears = parseRequiredYears(requirement.text);
      if (requiredYears !== null && experienceYears >= requiredYears) {
        reasons.push({
          requirementId: requirement.id,
          category: requirement.category,
          requirement: requirement.text,
          evidence: `${experienceYears} year(s) of verified work experience`,
          evidenceType: 'experience_duration',
          confidence: 'high',
        });
      } else {
        gaps.push({
          requirementId: requirement.id,
          category: requirement.category,
          requirement: requirement.text,
        });
      }
      continue;
    }

    // Ticket 06's extractor emits full sentences for these three
    // categories (the whole matched line), not an atomic term like it does
    // for skills/keywords — word-overlap fits sentence-vs-sentence
    // comparison; bidirectional containment doesn't.
    const useWordOverlap =
      requirement.category === 'responsibility' ||
      requirement.category === 'education' ||
      requirement.category === 'certification';
    const match = evidence.find((item) =>
      useWordOverlap
        ? wordOverlapMatches(requirement.text, item.text)
        : shortTextMatches(requirement.text, item.text),
    );

    if (match) {
      reasons.push({
        requirementId: requirement.id,
        category: requirement.category,
        requirement: requirement.text,
        evidence: match.text,
        evidenceType: match.type,
        confidence: useWordOverlap ? 'medium' : 'high',
      });
    } else {
      gaps.push({
        requirementId: requirement.id,
        category: requirement.category,
        requirement: requirement.text,
      });
    }
  }

  return { reasons, gaps };
}
