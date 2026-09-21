import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

describe('Dashboard (e2e)', () => {
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

  async function setPreferences(token: string, dto: object) {
    await request(app.getHttpServer())
      .patch('/job-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(dto);
  }

  async function addSkill(token: string, name: string) {
    await request(app.getHttpServer())
      .post('/candidate-profile/skill')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });
  }

  async function listJobs(token: string, query = '') {
    return request(app.getHttpServer())
      .get(`/dashboard/jobs${query}`)
      .set('Authorization', `Bearer ${token}`);
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

  it('lists Job Postings with their Match Score attached, sorted by score descending', async () => {
    const token = await createUserAndToken('owner@example.com');
    await addSkill(token, 'Python');
    await addSkill(token, 'PostgreSQL');
    await addSkill(token, 'Docker');

    const lowId = await submitJobPosting(token, {
      title: 'Low Match Role',
      description: 'Requirements:\nExperience with Kubernetes, Terraform and Ansible.',
    });
    const highId = await submitJobPosting(token, {
      title: 'High Match Role',
      description: 'Requirements:\nStrong experience with Python.\nExperience with PostgreSQL and Docker.',
    });

    const response = await listJobs(token);
    expect(response.status).toBe(200);
    const ids = response.body.responseBody.map((p: { id: string }) => p.id);
    expect(ids.indexOf(highId)).toBeLessThan(ids.indexOf(lowId));

    const high = response.body.responseBody.find((p: { id: string }) => p.id === highId);
    expect(high.matchScore.score).toBe(100);
    const low = response.body.responseBody.find((p: { id: string }) => p.id === lowId);
    expect(low.matchScore.score).toBe(0);
  });

  it('excludes hard-filtered postings from the dashboard entirely', async () => {
    const token = await createUserAndToken('owner@example.com');
    await setPreferences(token, { excludedCompanies: ['Acme'] });

    const excludedId = await submitJobPosting(token, { company: 'Acme' });
    const visibleId = await submitJobPosting(token, { company: 'Widgets Inc' });

    const response = await listJobs(token);
    const ids = response.body.responseBody.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(excludedId);
    expect(ids).toContain(visibleId);
  });

  it('the high-match view (minScore) surfaces only postings at or above the threshold', async () => {
    const token = await createUserAndToken('owner@example.com');
    await addSkill(token, 'Python');
    await addSkill(token, 'PostgreSQL');
    await addSkill(token, 'Docker');

    const lowId = await submitJobPosting(token, {
      title: 'Low Match Role',
      description: 'Requirements:\nExperience with Kubernetes, Terraform and Ansible.',
    });
    const highId = await submitJobPosting(token, {
      title: 'High Match Role',
      description: 'Requirements:\nStrong experience with Python.\nExperience with PostgreSQL and Docker.',
    });

    const response = await listJobs(token, '?minScore=50');
    const ids = response.body.responseBody.map((p: { id: string }) => p.id);
    expect(ids).toContain(highId);
    expect(ids).not.toContain(lowId);
  });

  it('leaves out postings with no extracted Requirements from a minScore filter (nothing to measure against)', async () => {
    const token = await createUserAndToken('owner@example.com');
    const bareId = await submitJobPosting(token, { description: 'Come work with us.' });

    const unfiltered = await listJobs(token);
    expect(unfiltered.body.responseBody.map((p: { id: string }) => p.id)).toContain(bareId);

    const filtered = await listJobs(token, '?minScore=1');
    expect(filtered.body.responseBody.map((p: { id: string }) => p.id)).not.toContain(bareId);
  });

  it('never lets one user see another user’s postings on the dashboard', async () => {
    const ownerToken = await createUserAndToken('owner@example.com');
    const intruderToken = await createUserAndToken('intruder@example.com');
    await submitJobPosting(ownerToken);

    const asIntruder = await listJobs(intruderToken);
    expect(asIntruder.body.responseBody).toEqual([]);
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer()).get('/dashboard/jobs');
    expect(response.status).toBe(401);
  });
});
