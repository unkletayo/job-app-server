import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

describe('Matching engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  async function submitJobPosting(token: string, overrides: Partial<Record<string, string>> = {}) {
    const submit = await request(app.getHttpServer())
      .post('/job-postings/manual-paste')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Remote',
        description: 'We build backend services.',
        ...overrides,
      });
    return submit.body.responseBody.id as string;
  }

  async function getDetail(token: string, id: string) {
    const detail = await request(app.getHttpServer())
      .get(`/job-postings/${id}`)
      .set('Authorization', `Bearer ${token}`);
    return detail.body.responseBody;
  }

  async function setPreferences(token: string, dto: object) {
    await request(app.getHttpServer())
      .patch('/job-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(dto);
  }

  async function setProfile(token: string, dto: object) {
    await request(app.getHttpServer())
      .put('/candidate-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(dto);
  }

  async function addSkill(token: string, name: string) {
    await request(app.getHttpServer())
      .post('/candidate-profile/skill')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });
  }

  async function addCertification(token: string, name: string, issuer: string) {
    await request(app.getHttpServer())
      .post('/candidate-profile/certification')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, issuer });
  }

  async function addExperience(token: string, yearsAgo: number) {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - yearsAgo);
    await request(app.getHttpServer())
      .post('/candidate-profile/experience')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Prior Co',
        title: 'Backend Engineer',
        startDate: startDate.toISOString(),
        description: 'Built backend REST services.',
      });
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('excludes a Job Posting outright when it fails a hard filter, rather than down-scoring it', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setPreferences(token, { excludedCompanies: ['Acme'] });

    const id = await submitJobPosting(token, { company: 'Acme' });
    const detail = await getDetail(token, id);

    expect(detail.matchScore).toMatchObject({
      excluded: true,
      score: null,
      reasons: [],
      gaps: [],
    });
    expect(detail.matchScore.exclusionReason).toContain('Acme');
  });

  it('excludes on disallowed employment type', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setPreferences(token, { employmentTypes: ['Full-time'] });

    const submit = await request(app.getHttpServer())
      .post('/job-postings/manual-paste')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Contractor Role', company: 'Acme', description: 'Contract work.' });
    const id = submit.body.responseBody.id as string;
    // ManualPasteAdapter doesn't set employmentType, so directly promote the
    // posting to a concrete type via Prisma to exercise this filter path.
    await prisma.jobPosting.update({ where: { id }, data: { employmentType: 'Contract' } });

    const detail = await getDetail(token, id);
    expect(detail.matchScore).toMatchObject({ excluded: true });
    expect(detail.matchScore.exclusionReason).toContain('Contract');
  });

  it('excludes on excluded title and negative keyword', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setPreferences(token, { excludedTitles: ['Manager'], negativeKeywords: ['unpaid'] });

    const managerId = await submitJobPosting(token, { title: 'Engineering Manager' });
    const managerDetail = await getDetail(token, managerId);
    expect(managerDetail.matchScore.excluded).toBe(true);

    const unpaidId = await submitJobPosting(token, {
      title: 'Backend Engineer',
      description: 'This is an unpaid internship.',
    });
    const unpaidDetail = await getDetail(token, unpaidId);
    expect(unpaidDetail.matchScore.excluded).toBe(true);
  });

  it('excludes when the posting states no sponsorship and the candidate needs it', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setProfile(token, { workAuthorization: 'Requires visa sponsorship' });

    const id = await submitJobPosting(token, {
      description: 'Must be authorized to work; we are unable to sponsor visas.',
    });
    const detail = await getDetail(token, id);
    expect(detail.matchScore.excluded).toBe(true);
    expect(detail.matchScore.exclusionReason).toContain('sponsor');
  });

  it('computes a high match score with cited evidence for every matched Requirement', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setProfile(token, { workAuthorization: 'US Citizen' });
    await addSkill(token, 'Python');
    await addCertification(token, 'AWS Certified Solutions Architect', 'Amazon');
    await addExperience(token, 3);

    const id = await submitJobPosting(token, {
      description: [
        'Requirements:',
        '2+ years of experience with backend development.',
        'Strong experience with Python.',
        'AWS certification preferred.',
      ].join('\n'),
    });
    const detail = await getDetail(token, id);

    expect(detail.matchScore.excluded).toBe(false);
    expect(detail.matchScore.score).toBe(100);
    expect(detail.matchScore.gaps).toEqual([]);
    expect(detail.matchScore.reasons.length).toBeGreaterThan(0);
    for (const reason of detail.matchScore.reasons) {
      expect(reason.evidence).toBeTruthy();
      expect(reason.requirement).toBeTruthy();
    }
    const skillReason = detail.matchScore.reasons.find(
      (r: { category: string; requirement: string }) =>
        r.category === 'required_skill' && r.requirement === 'python',
    );
    expect(skillReason).toMatchObject({ evidence: 'Python', evidenceType: 'skill' });
  });

  it('reports explicit Gaps for Requirements with no matching Evidence', async () => {
    const token = await createUserAndToken('owner@example.com');
    await addExperience(token, 4);

    const id = await submitJobPosting(token, {
      description: [
        'Requirements:',
        '3+ years of experience with backend development.',
        'Experience with Kubernetes and Docker.',
        "Bachelor's degree in Computer Science required.",
      ].join('\n'),
    });
    const detail = await getDetail(token, id);

    expect(detail.matchScore.excluded).toBe(false);
    expect(detail.matchScore.gaps.length).toBeGreaterThan(0);
    expect(detail.matchScore.reasons.length).toBeGreaterThan(0);
    const gapCategories = detail.matchScore.gaps.map((g: { category: string }) => g.category);
    expect(gapCategories).toEqual(expect.arrayContaining(['required_skill', 'education']));
    const experienceReason = detail.matchScore.reasons.find(
      (r: { category: string }) => r.category === 'experience',
    );
    expect(experienceReason).toBeTruthy();
  });

  it('does not use unverified Candidate Evidence to satisfy a Requirement', async () => {
    const token = await createUserAndToken('owner@example.com');
    await addSkill(token, 'Python');
    const [pythonSkill] = await prisma.skill.findMany({ where: { name: 'Python' } });
    await prisma.skill.update({ where: { id: pythonSkill.id }, data: { verified: false } });

    const id = await submitJobPosting(token, {
      description: 'Requirements:\nStrong experience with Python.',
    });
    const detail = await getDetail(token, id);

    expect(detail.matchScore.gaps.some((g: { category: string }) => g.category === 'required_skill')).toBe(
      true,
    );
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer()).get('/job-postings/nonexistent-id');
    expect(response.status).toBe(401);
  });
});
