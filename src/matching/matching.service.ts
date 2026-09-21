import { Injectable } from '@nestjs/common';
import { CandidateProfile, JobPosting, JobPreferences, Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobPreferencesService } from '../job-preferences/job-preferences.service';
import { evaluateHardFilters } from './hard-filters';
import { matchRequirements } from './requirement-matcher';
import { EvidenceItem, ExperienceEvidence, MatchScoreResult } from './types';

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

/** Below this many scorable Requirements a percentage is mostly noise —
 * one matched Requirement out of one is "100%". The score is withheld
 * (with a note) rather than reported; reasons and gaps are still returned,
 * so nothing about what matched is hidden. */
const MIN_SCORABLE_REQUIREMENTS = 3;

interface MatchingContext {
  preferences: JobPreferences | null;
  candidateProfile: CandidateProfile | null;
  evidence: EvidenceItem[];
  experiences: ExperienceEvidence[];
}

/**
 * Computes a deterministic Match Score for a Job Posting against the
 * user's Candidate Profile and Job Preferences (ticket 11,
 * 0003-deterministic-first-matching): hard filters first (exclude
 * outright), then structured Requirement/Evidence overlap for whatever
 * passes. No embeddings, no LLM call — every reason and gap traces back to
 * a specific Requirement and, where matched, a specific piece of verified
 * Candidate Evidence, never an unexplained number.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobPreferences: JobPreferencesService,
  ) {}

  async score(
    userId: string,
    jobPosting: JobPosting & { extractedRequirements: Requirement[] },
  ): Promise<MatchScoreResult> {
    const context = await this.loadContext(userId);
    return this.scoreWithContext(jobPosting, context);
  }

  /** Same scoring as `score`, but loads Job Preferences/Candidate
   * Profile/Evidence once and reuses them across every posting — the
   * dashboard (ticket 12) lists many postings per request, and none of
   * that context depends on which posting is being scored. */
  async scoreMany(
    userId: string,
    jobPostings: (JobPosting & { extractedRequirements: Requirement[] })[],
  ): Promise<MatchScoreResult[]> {
    const context = await this.loadContext(userId);
    return jobPostings.map((jobPosting) => this.scoreWithContext(jobPosting, context));
  }

  private async loadContext(userId: string): Promise<MatchingContext> {
    const [preferences, candidateProfile, skills, certifications, education, experiences, projects, achievements] =
      await Promise.all([
        this.jobPreferences.findOne(userId),
        this.prisma.candidateProfile.findUnique({ where: { userId } }),
        this.prisma.skill.findMany({ where: { userId, verified: true } }),
        this.prisma.certification.findMany({ where: { userId, verified: true } }),
        this.prisma.education.findMany({ where: { userId, verified: true } }),
        this.prisma.experience.findMany({ where: { userId, verified: true } }),
        this.prisma.project.findMany({ where: { userId, verified: true } }),
        this.prisma.achievement.findMany({ where: { userId, verified: true } }),
      ]);

    const evidence: EvidenceItem[] = [
      ...skills.map((s): EvidenceItem => ({ type: 'skill', text: s.name })),
      ...certifications.map((c): EvidenceItem => ({ type: 'certification', text: c.name })),
      ...education.map(
        (e): EvidenceItem => ({
          type: 'education',
          text: [e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(' '),
        }),
      ),
      ...experiences.map(
        (e): EvidenceItem => ({
          type: 'experience',
          text: [e.title, e.company, e.description].filter(Boolean).join(' — '),
        }),
      ),
      ...projects.map(
        (p): EvidenceItem => ({
          type: 'project',
          text: [p.name, p.description, ...p.technologies].filter(Boolean).join(' — '),
        }),
      ),
      ...achievements.map((a): EvidenceItem => ({ type: 'achievement', text: a.description })),
    ];

    const experienceEntries: ExperienceEvidence[] = experiences.map((experience) => {
      const end = experience.endDate ?? new Date();
      const years = (end.getTime() - experience.startDate.getTime()) / MS_PER_YEAR;
      return {
        label: `${experience.title} — ${experience.company}`,
        text: [experience.title, experience.company, experience.description]
          .filter(Boolean)
          .join(' — '),
        years: Math.max(years, 0),
      };
    });

    return { preferences, candidateProfile, evidence, experiences: experienceEntries };
  }

  private scoreWithContext(
    jobPosting: JobPosting & { extractedRequirements: Requirement[] },
    context: MatchingContext,
  ): MatchScoreResult {
    const { excluded, reason } = evaluateHardFilters(
      jobPosting,
      context.preferences,
      context.candidateProfile,
    );
    if (excluded) {
      return {
        excluded: true,
        exclusionReason: reason,
        score: null,
        scoreNote: null,
        reasons: [],
        gaps: [],
      };
    }

    if (jobPosting.extractedRequirements.length === 0) {
      return {
        excluded: false,
        exclusionReason: null,
        score: null,
        scoreNote: 'No Requirements could be extracted from this posting, so there is nothing to score against.',
        reasons: [],
        gaps: [],
      };
    }

    const { reasons, gaps } = matchRequirements(
      jobPosting.extractedRequirements,
      context.evidence,
      context.experiences,
    );

    const scorable = reasons.length + gaps.length;
    if (scorable < MIN_SCORABLE_REQUIREMENTS) {
      return {
        excluded: false,
        exclusionReason: null,
        score: null,
        scoreNote: `Only ${scorable} scorable Requirement(s) were found (at least ${MIN_SCORABLE_REQUIREMENTS} needed), so a percentage would be misleading.`,
        reasons,
        gaps,
      };
    }

    const score = Math.round((reasons.length / scorable) * 100);
    return { excluded: false, exclusionReason: null, score, scoreNote: null, reasons, gaps };
  }
}
