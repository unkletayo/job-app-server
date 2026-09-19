import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { AshbyClient, AshbyJob } from '../src/job-discovery/ashby/ashby-client';

jest.setTimeout(15000);

describe('Ashby adapter (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const fetchJobs = jest.fn<Promise<AshbyJob[]>, [string]>();

  function job(overrides: Partial<AshbyJob> & { id: string }): AshbyJob {
    return {
      title: 'Backend Engineer',
      location: 'Remote',
      employmentType: 'FullTime',
      workplaceType: 'Remote',
      isListed: true,
      publishedAt: '2026-01-01T00:00:00Z',
      descriptionPlain: 'Build APIs',
      // Derived from `id` (not a fixed default) so two calls that only
      // override id/title don't accidentally collide on Job Cluster
      // dedup's canonical-URL signal (0003-deterministic-first-matching).
      applyUrl: `https://jobs.ashbyhq.com/acme/${overrides.id}/application`,
      ...overrides,
    };
  }

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  async function configureFastThrottle(token: string): Promise<void> {
    await request(app.getHttpServer())
      .patch('/discovery/sources/ashby')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestsPerMinute: 6000 });
  }

  async function watchBoard(token: string, boardToken: string, label: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'ashby', boardToken, label });
    expect(res.status).toBe(201);
  }

  async function triggerRun(token: string) {
    return request(app.getHttpServer())
      .post('/discovery/sources/ashby/run')
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AshbyClient)
      .useValue({ fetchJobs })
      .compile();

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
    fetchJobs.mockReset();
  });

  it('normalizes listed jobs, skips unlisted ones, and advances the checkpoint', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');

    const jobA = job({ id: 'a1', title: 'Backend Engineer' });
    const jobB = job({
      id: 'a2',
      title: 'Designer (Draft)',
      isListed: false,
      publishedAt: '2026-01-02T00:00:00Z',
    });
    fetchJobs.mockResolvedValue([jobA, jobB]);

    const firstRun = await triggerRun(token);
    expect(firstRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(1);
    expect(postings.body.responseBody[0]).toMatchObject({
      title: 'Backend Engineer',
      company: 'Acme Corp',
      description: 'Build APIs',
      location: ['Remote'],
      remoteType: 'Remote',
      employmentType: 'FullTime',
      applicationUrl: 'https://jobs.ashbyhq.com/acme/a1/application',
    });

    // Unchanged publishedAt on the same job — checkpoint should filter it out.
    const secondRun = await triggerRun(token);
    expect(secondRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 0,
      jobsCreated: 0,
    });

    // A newly published job alongside the untouched one.
    const jobC = job({ id: 'a3', title: 'Platform Engineer', publishedAt: new Date().toISOString() });
    fetchJobs.mockResolvedValue([jobA, jobC]);

    const thirdRun = await triggerRun(token);
    expect(thirdRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });

    const finalPostings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(finalPostings.body.responseBody).toHaveLength(2);
  });

  it('skips a board whose fetch fails without failing the whole run', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');
    await watchBoard(token, 'widgets', 'Widgets Inc');

    fetchJobs.mockImplementation(async (boardToken: string) => {
      if (boardToken === 'widgets') {
        throw new Error('Ashby API returned 404 for board "widgets".');
      }
      return [job({ id: 'b1', title: 'Data Engineer' })];
    });

    const run = await triggerRun(token);
    expect(run.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });
  });

  it('does not poison the checkpoint by running before any board is watched', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);

    const emptyRun = await triggerRun(token);
    expect(emptyRun.body.responseBody).toMatchObject({ status: 'succeeded', jobsFetched: 0 });

    await watchBoard(token, 'acme', 'Acme Corp');
    const oldJob = job({ id: 'old-1', title: 'Legacy Engineer', publishedAt: '2020-01-01T00:00:00Z' });
    fetchJobs.mockResolvedValue([oldJob]);

    const run = await triggerRun(token);
    expect(run.body.responseBody).toMatchObject({ status: 'succeeded', jobsFetched: 1, jobsCreated: 1 });
  });
});
