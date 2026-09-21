import { Requirement } from '@prisma/client';
import { EvidenceItem, ExperienceEvidence, MatchGap, MatchReason } from './types';

const STOPWORDS = new Set([
  'with', 'and', 'the', 'for', 'from', 'that', 'this', 'have', 'will', 'your',
  'you', 'our', 'are', 'was', 'were', 'into', 'their', 'they', 'able', 'across',
]);

const YEARS_PATTERN = /(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?\+?\s*years?/i;

/** Shared significant words needed for a word-overlap match. A
 * responsibility is a whole sentence, so one shared word ("backend", "team",
 * "build") says almost nothing — it takes two to call it evidence. Education
 * and certification text is short and specific, so one shared word ("AWS",
 * "Computer Science") still counts. */
const MIN_SHARED_WORDS = 1;
const MIN_SHARED_RESPONSIBILITY_WORDS = 2;

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
 * no synonym/embedding matching (0003-deterministic-first-matching).
 * `minShared` distinct words must appear in the evidence (or all of them,
 * when the requirement has fewer than that). */
function wordOverlapMatches(requirementText: string, evidenceText: string, minShared: number): boolean {
  const words = [...new Set(significantWords(requirementText))];
  if (words.length === 0) return false;
  const evidence = normalize(evidenceText);
  const shared = words.filter((word) => containsWholeWord(evidence, word)).length;
  return shared >= Math.min(minShared, words.length);
}

function parseRequiredYears(requirementText: string): number | null {
  const match = requirementText.match(YEARS_PATTERN);
  return match ? Number(match[1]) : null;
}

/** Words that make up the *shape* of an experience requirement rather than
 * its field ("5+ years of relevant experience in ...") — removed so what's
 * left is the domain the years have to have been spent in. */
const GENERIC_EXPERIENCE_WORDS = new Set([
  'years', 'year', 'experience', 'relevant', 'work', 'working', 'including', 'plus', 'preferred',
  'strong', 'proven', 'professional', 'related', 'role', 'roles', 'similar', 'minimum', 'least',
  'more', 'equivalent', 'field', 'demonstrated', 'hands', 'solid', 'prior', 'industry',
]);

function experienceDomainWords(requirementText: string): string[] {
  return significantWords(requirementText).filter(
    (word) => !GENERIC_EXPERIENCE_WORDS.has(word) && !/^\d+$/.test(word),
  );
}

/**
 * Matches a Job Posting's extracted Requirements (ticket 06) against the
 * candidate's verified Evidence (CONTEXT.md), per
 * 0003-deterministic-first-matching — keyword/word-overlap only, no
 * embeddings.
 *
 * `experience`-category Requirements (which ticket 06's extractor only ever
 * produces from a "N years ... experience" pattern) are checked against
 * *relevant* work history: only Experience entries whose text shares a
 * domain word with the requirement count toward its years. A requirement
 * with no domain words at all ("5+ years of experience") falls back to all
 * verified experience. Counting total years regardless of field is what let
 * 11 years of backend work "satisfy" a 7+ year law-firm requirement.
 *
 * Extraction emits every skill twice, as a `required_skill`/`preferred_skill`
 * and again as a `keyword`; a keyword that repeats a skill is skipped here so
 * one skill isn't counted (and explained) twice.
 */
export function matchRequirements(
  allRequirements: Requirement[],
  evidence: EvidenceItem[],
  experiences: ExperienceEvidence[],
): { reasons: MatchReason[]; gaps: MatchGap[] } {
  const reasons: MatchReason[] = [];
  const gaps: MatchGap[] = [];

  const skillTexts = new Set(
    allRequirements
      .filter((r) => r.category === 'required_skill' || r.category === 'preferred_skill')
      .map((r) => normalize(r.text)),
  );
  const requirements = allRequirements.filter(
    (r) => !(r.category === 'keyword' && skillTexts.has(normalize(r.text))),
  );

  for (const requirement of requirements) {
    if (requirement.category === 'experience') {
      const requiredYears = parseRequiredYears(requirement.text);
      const domainWords = experienceDomainWords(requirement.text);
      const relevant =
        domainWords.length === 0
          ? experiences
          : experiences.filter((entry) =>
              domainWords.some((word) => containsWholeWord(normalize(entry.text), word)),
            );
      const relevantYears = Math.floor(relevant.reduce((total, entry) => total + entry.years, 0));

      if (requiredYears !== null && relevant.length > 0 && relevantYears >= requiredYears) {
        reasons.push({
          requirementId: requirement.id,
          category: requirement.category,
          requirement: requirement.text,
          evidence: `${relevantYears} year(s) of verified work experience: ${relevant
            .map((entry) => entry.label)
            .join('; ')}`,
          evidenceType: 'experience_duration',
          confidence: domainWords.length === 0 ? 'medium' : 'high',
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
    const minShared =
      requirement.category === 'responsibility' ? MIN_SHARED_RESPONSIBILITY_WORDS : MIN_SHARED_WORDS;
    const match = evidence.find((item) =>
      useWordOverlap
        ? wordOverlapMatches(requirement.text, item.text, minShared)
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
