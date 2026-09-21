import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { GreenhouseClient, GreenhouseJob } from '../src/job-discovery/greenhouse/greenhouse-client';

jest.setTimeout(15000);

describe('Greenhouse adapter (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const fetchJobs = jest.fn<Promise<GreenhouseJob[]>, [string]>();

  function job(overrides: Partial<GreenhouseJob>): GreenhouseJob {
    return {
      id: 1,
      title: 'Backend Engineer',
      updated_at: '2026-01-01T00:00:00Z',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/1',
      location: { name: 'Remote' },
      content: '<p>Build APIs</p>',
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
      .patch('/discovery/sources/greenhouse')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestsPerMinute: 6000 });
  }

  async function watchBoard(token: string, boardToken: string, label: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'greenhouse', boardToken, label });
    expect(res.status).toBe(201);
  }

  async function triggerRun(token: string) {
    return request(app.getHttpServer())
      .post('/discovery/sources/greenhouse/run')
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GreenhouseClient)
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

  it('normalizes fixture jobs and advances the checkpoint so unchanged jobs are not refetched', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');

    const jobA = job({
      id: 1001,
      title: 'Backend Engineer',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/1001',
      location: { name: 'Remote' },
    });
    const jobB = job({
      id: 1002,
      title: 'Frontend Engineer',
      updated_at: '2026-01-02T00:00:00Z',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/1002',
      location: { name: 'NYC' },
      content: '<p>Build UI</p>',
    });
    fetchJobs.mockResolvedValue([jobA, jobB]);

    const firstRun = await triggerRun(token);
    expect(firstRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 2,
      jobsCreated: 2,
      jobsMerged: 0,
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(2);
    const byTitle = (title: string) =>
      postings.body.responseBody.find((p: { title: string }) => p.title === title);
    expect(byTitle('Backend Engineer')).toMatchObject({
      company: 'Acme Corp',
      description: 'Build APIs',
      location: ['Remote'],
      applicationUrl: 'https://boards.greenhouse.io/acme/jobs/1001',
    });
    expect(byTitle('Frontend Engineer')).toMatchObject({ company: 'Acme Corp', location: ['NYC'] });

    // Same two jobs, unchanged updated_at — checkpoint should filter both out.
    const secondRun = await triggerRun(token);
    expect(secondRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 0,
      jobsCreated: 0,
      jobsMerged: 0,
    });

    // jobB edited (newer updated_at) + a brand new jobC — only those two should surface.
    const editedJobB = { ...jobB, content: '<p>Build UI v2</p>', updated_at: new Date().toISOString() };
    const jobC = job({
      id: 1003,
      title: 'Platform Engineer',
      updated_at: new Date().toISOString(),
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/1003',
    });
    fetchJobs.mockResolvedValue([jobA, editedJobB, jobC]);

    const thirdRun = await triggerRun(token);
    expect(thirdRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 2,
      jobsMerged: 1,
      jobsCreated: 1,
    });

    const finalPostings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(finalPostings.body.responseBody).toHaveLength(3);
  });

  it('skips a board whose fetch fails without failing the whole run', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');
    await watchBoard(token, 'widgets', 'Widgets Inc');

    fetchJobs.mockImplementation(async (boardToken: string) => {
      if (boardToken === 'widgets') {
        throw new Error('Greenhouse API returned 404 for board "widgets".');
      }
      return [job({ id: 2001, title: 'Data Engineer' })];
    });

    const run = await triggerRun(token);
    expect(run.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(1);
    expect(postings.body.responseBody[0].title).toBe('Data Engineer');
  });

  it('does not poison the checkpoint by running before any board is watched', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);

    // No watched boards yet — should succeed as a no-op, not advance the
    // timestamp checkpoint to "now" (see DiscoveryRunnerService/adapter
    // comment: that would silently hide every pre-existing job once a
    // board is watched later, since this adapter's incremental filter is
    // purely time-based).
    const emptyRun = await triggerRun(token);
    expect(emptyRun.body.responseBody).toMatchObject({ status: 'succeeded', jobsFetched: 0 });

    await watchBoard(token, 'acme', 'Acme Corp');
    const oldJob = job({
      id: 3001,
      title: 'Legacy Engineer',
      updated_at: '2020-01-01T00:00:00Z',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/3001',
    });
    fetchJobs.mockResolvedValue([oldJob]);

    const run = await triggerRun(token);
    expect(run.body.responseBody).toMatchObject({ status: 'succeeded', jobsFetched: 1, jobsCreated: 1 });
  });
});
