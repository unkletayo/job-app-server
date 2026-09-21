import { Injectable } from '@nestjs/common';
import { htmlToPlainText } from './text-normalization';

export type RequirementCategory =
  | 'required_skill'
  | 'preferred_skill'
  | 'experience'
  | 'education'
  | 'certification'
  | 'responsibility'
  | 'keyword';

export interface ExtractedRequirement {
  category: RequirementCategory;
  text: string;
}

const REQUIRED_HEADERS = ['requirements', 'required qualifications', 'qualifications', 'must have', 'minimum qualifications', 'basic qualifications'];
const PREFERRED_HEADERS = ['preferred qualifications', 'preferred', 'nice to have', 'nice-to-have', 'bonus points', 'bonus'];
const RESPONSIBILITY_HEADERS = ["responsibilities", "what you'll do", 'what you will do', 'duties', 'the role'];

const SKILL_VOCABULARY = [
  'javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c++', 'c#', 'ruby', 'php',
  'sql', 'nosql', 'react', 'angular', 'vue', 'node.js', 'nodejs', 'express', 'nestjs', 'django',
  'flask', 'spring', '.net', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd',
  'git', 'graphql', 'rest', 'postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka',
  'rabbitmq', 'linux', 'agile', 'scrum', 'machine learning', 'tensorflow', 'pytorch', 'html', 'css',
  'sass', 'webpack', 'jenkins', 'ansible', 'microservices',
];

const DEGREE_VOCABULARY = [
  "bachelor's degree", 'bachelor degree', 'bachelors degree', "master's degree", 'master degree',
  'masters degree', 'phd', 'ph.d', 'doctorate', "associate's degree", 'associate degree', 'mba',
  'b.s.', 'b.a.', 'm.s.', 'm.a.',
];

const CERTIFICATION_VOCABULARY = [
  'certified', 'certification', 'certificate in', 'pmp', 'cissp', 'cisa', 'ccna', 'cpa', 'scrum master',
];

const RESPONSIBILITY_VERBS = [
  'build', 'design', 'lead', 'develop', 'own', 'manage', 'create', 'collaborate', 'drive',
  'implement', 'maintain', 'support', 'write', 'architect', 'mentor', 'partner', 'define', 'improve',
];

const EXPERIENCE_PATTERN = /\b\d{1,2}\+?\s*(?:-\s*\d{1,2}\s*)?\+?\s*years?\b[^.\n]*\bexperience\b|\bexperience\b[^.\n]*\b\d{1,2}\+?\s*(?:-\s*\d{1,2}\s*)?\+?\s*years?\b/i;

type Section = 'required' | 'preferred' | 'responsibility' | null;

function matchesHeader(line: string, headers: string[]): boolean {
  const normalized = line.trim().toLowerCase().replace(/:$/, '');
  return headers.includes(normalized);
}

function splitIntoLines(description: string): string[] {
  return description
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function dedupe(entries: ExtractedRequirement[]): ExtractedRequirement[] {
  const seen = new Set<string>();
  const result: ExtractedRequirement[] = [];
  for (const entry of entries) {
    const key = `${entry.category}:${entry.text.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

/**
 * Deterministic, rule-based Requirement extraction (ticket 06) — keyword and
 * pattern matching against known skill/qualification vocabularies, per PRD
 * §13. No LLM Gateway call anywhere in this path (0004-llm-gateway-
 * abstraction, 0003-deterministic-first-matching's same no-LLM-in-Phase-1
 * stance for the request path). The description is only ever mined for
 * Requirement-shaped substrings — never interpreted as instructions, so
 * injection-style content (PRD §23/§63) just fails to match anything and
 * produces an empty/partial list like any other unstructured text would.
 */
@Injectable()
export class RequirementExtractionService {
  extract(description: string): ExtractedRequirement[] {
    const lines = splitIntoLines(htmlToPlainText(description));
    const results: ExtractedRequirement[] = [];
    let section: Section = null;

    for (const line of lines) {
      if (matchesHeader(line, REQUIRED_HEADERS)) {
        section = 'required';
        continue;
      }
      if (matchesHeader(line, PREFERRED_HEADERS)) {
        section = 'preferred';
        continue;
      }
      if (matchesHeader(line, RESPONSIBILITY_HEADERS)) {
        section = 'responsibility';
        continue;
      }

      const lower = line.toLowerCase();

      if (EXPERIENCE_PATTERN.test(line)) {
        results.push({ category: 'experience', text: line });
      }

      for (const degree of DEGREE_VOCABULARY) {
        if (lower.includes(degree)) {
          results.push({ category: 'education', text: line });
          break;
        }
      }

      for (const cert of CERTIFICATION_VOCABULARY) {
        if (lower.includes(cert)) {
          results.push({ category: 'certification', text: line });
          break;
        }
      }

      for (const skill of SKILL_VOCABULARY) {
        const pattern = new RegExp(`\\b${skill.replace(/[.+]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(line)) {
          const skillCategory = section === 'preferred' ? 'preferred_skill' : 'required_skill';
          results.push({ category: skillCategory, text: skill });
          results.push({ category: 'keyword', text: skill });
        }
      }

      const firstWord = line.replace(/^[-•*\s]+/, '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (section === 'responsibility' || (firstWord && RESPONSIBILITY_VERBS.includes(firstWord))) {
        results.push({ category: 'responsibility', text: line });
      }
    }

    return dedupe(results);
  }
}
