import { CandidateProfile, JobPosting, JobPreferences } from '@prisma/client';
import { htmlToPlainText } from '../job-postings/text-normalization';

/** Phrases a posting uses to state it won't sponsor work authorization.
 * Deterministic keyword matching, same style as ticket 06's requirement
 * extraction — not a claim about every possible phrasing a posting might
 * use, just the common, unambiguous ones. */
const NO_SPONSORSHIP_PHRASES = [
  'no sponsorship',
  'not able to sponsor',
  'unable to sponsor',
  'without sponsorship',
  'no visa sponsorship',
  'cannot sponsor',
  "won't sponsor",
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Hard filters (0003-deterministic-first-matching, PRD §31) — run before
 * any scoring. A Job Posting failing one of these is excluded outright,
 * never merely down-scored. Every check here is "exclude only when there's
 * unambiguous data saying to" — missing data (no preferences configured,
 * no candidate profile, a field the posting's adapter didn't populate)
 * never excludes on its own; PRD §31 rules out manufacturing certainty
 * matching doesn't have.
 */
export function evaluateHardFilters(
  jobPosting: JobPosting,
  preferences: JobPreferences | null,
  candidateProfile: CandidateProfile | null,
): { excluded: boolean; reason: string | null } {
  if (candidateProfile?.workAuthorization) {
    const authorization = normalize(candidateProfile.workAuthorization);
    const candidateNeedsSponsorship =
      authorization.includes('sponsor') || authorization.includes('visa');
    if (candidateNeedsSponsorship) {
      const description = normalize(htmlToPlainText(jobPosting.description));
      const statesNoSponsorship = NO_SPONSORSHIP_PHRASES.some((phrase) =>
        description.includes(phrase),
      );
      if (statesNoSponsorship) {
        return {
          excluded: true,
          reason:
            'Posting states it does not sponsor work authorization, which the candidate profile indicates is required.',
        };
      }
    }
  }

  if (!preferences) {
    return { excluded: false, reason: null };
  }

  if (
    preferences.employmentTypes.length > 0 &&
    jobPosting.employmentType &&
    !preferences.employmentTypes.some(
      (type) => normalize(type) === normalize(jobPosting.employmentType as string),
    )
  ) {
    return {
      excluded: true,
      reason: `Employment type "${jobPosting.employmentType}" is not in the allowed employment types.`,
    };
  }

  const excludedCompany = preferences.excludedCompanies.find(
    (company) => normalize(company) === normalize(jobPosting.company),
  );
  if (excludedCompany) {
    return { excluded: true, reason: `"${jobPosting.company}" is an excluded company.` };
  }

  const excludedTitle = preferences.excludedTitles.find((title) =>
    normalize(jobPosting.title).includes(normalize(title)),
  );
  if (excludedTitle) {
    return { excluded: true, reason: `Title matches excluded title "${excludedTitle}".` };
  }

  const searchableText = normalize(
    `${jobPosting.title} ${htmlToPlainText(jobPosting.description)}`,
  );
  const negativeKeyword = preferences.negativeKeywords.find((keyword) =>
    searchableText.includes(normalize(keyword)),
  );
  if (negativeKeyword) {
    return { excluded: true, reason: `Contains excluded keyword "${negativeKeyword}".` };
  }

  return { excluded: false, reason: null };
}
