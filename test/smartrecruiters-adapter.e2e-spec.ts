import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import {
  SmartRecruitersClient,
  SmartRecruitersPostingDetail,
  SmartRecruitersPostingSummary,
} from '../src/job-discovery/smartrecruiters/smartrecruiters-client';

jest.setTimeout(15000);

describe('SmartRecruiters adapter (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const listPostings = jest.fn<Promise<SmartRecruitersPostingSummary[]>, [string]>();
  const fetchPosting = jest.fn<Promise<SmartRecruitersPostingDetail>, [string, string]>();

  function summary(overrides: Partial<SmartRecruitersPostingSummary>): SmartRecruitersPostingSummary {
    return {
      id: 'p-1',
      name: 'Backend Engineer',
      releasedDate: '2026-01-01T00:00:00Z',
      location: { fullLocation: 'Remote', remote: true },
      typeOfEmployment: { label: 'Full-time' },
      ...overrides,
    };
  }

  function detail(overrides: Partial<SmartRecruitersPostingDetail> = {}): SmartRecruitersPostingDetail {
    return {
      applyUrl: 'https://jobs.smartrecruiters.com/acme/p-1',
      jobAd: { sections: { jobDescription: { title: 'Job Description', text: 'Build APIs' } } },
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
      .patch('/discovery/sources/smartrecruiters')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestsPerMinute: 6000 });
  }

  async function watchBoard(token: string, boardToken: string, label: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'smartrecruiters', boardToken, label });
    expect(res.status).toBe(201);
  }

  async function triggerRun(token: string) {
    return request(app.getHttpServer())
      .post('/discovery/sources/smartrecruiters/run')
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SmartRecruitersClient)
      .useValue({ listPostings, fetchPosting })
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
    listPostings.mockReset();
    fetchPosting.mockReset();
  });

  it('normalizes list+detail postings and does not reprocess already-seen ones', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');

    const summaryA = summary({ id: 'p-1', name: 'Backend Engineer' });
    const summaryB = summary({
      id: 'p-2',
      name: 'Frontend Engineer',
      location: { fullLocation: 'NYC', remote: false },
    });
    listPostings.mockResolvedValue([summaryA, summaryB]);
    fetchPosting.mockImplementation(async (_company: string, postingId: string) =>
      detail({ applyUrl: `https://jobs.smartrecruiters.com/acme/${postingId}` }),
    );

    const firstRun = await triggerRun(token);
    expect(firstRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 2,
      jobsCreated: 2,
    });
    expect(fetchPosting).toHaveBeenCalledTimes(2);

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
      remoteType: 'Remote',
      employmentType: 'Full-time',
      applicationUrl: 'https://jobs.smartrecruiters.com/acme/p-1',
    });
    expect(byTitle('Frontend Engineer')).toMatchObject({ location: ['NYC'], remoteType: null });

    // Same two postings again — the seen-id set (not a date filter, since
    // SmartRecruiters gives no reliable "since" signal) must skip both, and
    // no new detail calls should happen for postings already seen.
    fetchPosting.mockClear();
    const secondRun = await triggerRun(token);
    expect(secondRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 0,
      jobsCreated: 0,
    });
    expect(fetchPosting).not.toHaveBeenCalled();

    // A genuinely new posting alongside the two already-seen ones.
    const summaryC = summary({ id: 'p-3', name: 'Platform Engineer' });
    listPostings.mockResolvedValue([summaryA, summaryB, summaryC]);

    const thirdRun = await triggerRun(token);
    expect(thirdRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });

    const finalPostings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(finalPostings.body.responseBody).toHaveLength(3);
  });

  it('skips a posting whose detail fetch fails without failing the run', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');

    listPostings.mockResolvedValue([
      summary({ id: 'ok-1', name: 'Good Posting' }),
      summary({ id: 'bad-1', name: 'Broken Posting' }),
    ]);
    fetchPosting.mockImplementation(async (_company: string, postingId: string) => {
      if (postingId === 'bad-1') {
        throw new Error('SmartRecruiters API returned 500 for posting "bad-1".');
      }
      return detail();
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
    expect(postings.body.responseBody[0].title).toBe('Good Posting');
  });

  it('skips a board whose list call fails without failing the whole run', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');
    await watchBoard(token, 'widgets', 'Widgets Inc');

    listPostings.mockImplementation(async (boardToken: string) => {
      if (boardToken === 'widgets') {
        throw new Error('SmartRecruiters API returned 404 for company "widgets".');
      }
      return [summary({ id: 'c1', name: 'Data Engineer' })];
    });
    fetchPosting.mockResolvedValue(detail());

    const run = await triggerRun(token);
    expect(run.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 1,
      jobsCreated: 1,
    });
  });
});
