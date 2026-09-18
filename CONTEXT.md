# Job Search Agent

A personal job-search and application platform: discovers jobs, tailors application materials, and (in later phases, under explicit permission) submits applications — while keeping the user in control of every consequential action.

## Language

### Jobs

**Job Posting**:
The canonical, normalized representation of a job opening, built from one or more Source Postings. This is what the app shows, scores, and tracks.
_Avoid_: Job, listing, opening (too vague — use Job Posting when referring to the normalized record).

**Source Posting**:
The raw, as-fetched data for a job from a single source (a Greenhouse API response, a pasted LinkedIn description). Preserved unmodified; never overwritten by normalization.
_Avoid_: Raw job, original posting.

**Job Cluster**:
A group of Source Postings that represent the same real-world job (e.g. the same role posted on both Greenhouse and pasted from LinkedIn), collapsed into one Job Posting so the user never sees duplicates.
_Avoid_: Duplicate group, merged job.

**Requirement**:
A single skill, qualification, or expectation extracted from a Job Posting's description (e.g. "5 years Java", "REST API experience"). Requirements are what Candidate Evidence gets matched against.
_Avoid_: Qualification, criterion.

### Sources

**Sanctioned Source**:
A job source with an official, publicly documented read API that permits automated discovery without violating its terms — currently Greenhouse, Lever, Ashby, SmartRecruiters. Discovery for these runs unattended on a schedule.
_Avoid_: Supported source, API source.

**Manual-Assist Source**:
A job source with no permitted automated access — currently LinkedIn and Glassdoor. The system never makes a server-side request to these domains; the user pastes the job's raw text/fields themselves, and it's normalized identically to any other Job Posting from there on.
_Avoid_: Unsupported source, paste source (paste is the *mechanism*, not what defines the category — the definition is "no server-side request, ever," which also applies to sources that simply block fetches).

**Source Adapter**:
The isolated integration module for one job source (one per Sanctioned Source). Contains all site-specific logic — the core application never talks to a source directly.
_Avoid_: Connector, integration, scraper (this project does not scrape).

### Candidate

**Candidate Profile**:
The structured record of the user's professional background — experience, education, skills, preferences — that Job Postings are matched against. Built via manual forms in Phase 1; there is no resume-file import yet.
_Avoid_: Resume (a Candidate Profile is structured data; a resume is a generated document derived from it), user profile.

**Candidate Evidence**:
A specific, verified fact from the Candidate Profile (an experience, a project, a skill) that can be cited as support for a Requirement being met. Evidence has provenance (`user_profile`, `ai_generated`, etc.) and a verified flag — only verified evidence may be used in anything auto-submitted.
_Avoid_: Fact, claim.

**Job Preferences**:
The user's configured search criteria (target roles, locations, salary floor, employment types, excluded companies, keywords) that gate what Job Discovery surfaces and how Matching scores results.
_Avoid_: Search settings, filters (filters are one mechanism Job Preferences drive, not the concept itself).

### Matching

**Match Score**:
A Job Posting's fit against the Candidate Profile and Job Preferences, always accompanied by the specific reasons and gaps that produced it — never an unexplained number. Phase 1 computes this deterministically (hard filters + structured requirement/evidence overlap); semantic and LLM-reasoned scoring is a later layer, not a replacement.
_Avoid_: Relevance score, ranking.

**Gap**:
A Requirement with no matching Candidate Evidence, surfaced explicitly on a Job Posting rather than silently lowering the Match Score with no explanation.
_Avoid_: Missing requirement (Gap is the canonical term once a Requirement has been checked against Evidence and found unmet).

### Permissions

**Capability**:
Something the system is technically able to do (e.g. fill a form, submit an application). Distinct from Permission — capability is never treated as implied authorization.
_Avoid_: Ability.

**Permission**:
Something the user has explicitly authorized the system to do. Every consequential action requires both the Capability and the Permission before it runs; the system never infers one from the other.
_Avoid_: Access, scope (Permission is the concept; a "permission scope" is one specific grant of it, e.g. `resume.write`).
