import { Injectable } from '@nestjs/common';
import { JobPosting, Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobPreferencesService } from '../job-preferences/job-preferences.service';
import { evaluateHardFilters } from './hard-filters';
import { matchRequirements } from './requirement-matcher';
import { EvidenceItem, MatchScoreResult } from './types';

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

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
    const [preferences, candidateProfile] = await Promise.all([
      this.jobPreferences.findOne(userId),
      this.prisma.candidateProfile.findUnique({ where: { userId } }),
    ]);

    const { excluded, reason } = evaluateHardFilters(jobPosting, preferences, candidateProfile);
    if (excluded) {
      return { excluded: true, exclusionReason: reason, score: null, reasons: [], gaps: [] };
    }

    if (jobPosting.extractedRequirements.length === 0) {
      return { excluded: false, exclusionReason: null, score: null, reasons: [], gaps: [] };
    }

    const [skills, certifications, education, experiences, projects, achievements] =
      await Promise.all([
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

    const experienceYears = experiences.reduce((total, experience) => {
      const end = experience.endDate ?? new Date();
      const years = (end.getTime() - experience.startDate.getTime()) / MS_PER_YEAR;
      return total + Math.max(years, 0);
    }, 0);

    const { reasons, gaps } = matchRequirements(
      jobPosting.extractedRequirements,
      evidence,
      Math.floor(experienceYears),
    );

    const total = jobPosting.extractedRequirements.length;
    const score = Math.round((reasons.length / total) * 100);

    return { excluded: false, exclusionReason: null, score, reasons, gaps };
  }
}
