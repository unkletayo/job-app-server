import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { LeverClient, LeverPosting } from '../src/job-discovery/lever/lever-client';

jest.setTimeout(15000);

describe('Lever adapter (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const fetchPostings = jest.fn<Promise<LeverPosting[]>, [string]>();

  function posting(overrides: Partial<LeverPosting>): LeverPosting {
    return {
      id: 'posting-1',
      text: 'Backend Engineer',
      categories: { location: 'Remote', commitment: 'Full-time' },
      descriptionPlain: 'Build APIs',
      hostedUrl: 'https://jobs.lever.co/acme/posting-1',
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
      .patch('/discovery/sources/lever')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestsPerMinute: 6000 });
  }

  async function watchBoard(token: string, boardToken: string, label: string): Promise<void> {
    const res = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'lever', boardToken, label });
    expect(res.status).toBe(201);
  }

  async function triggerRun(token: string) {
    return request(app.getHttpServer())
      .post('/discovery/sources/lever/run')
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LeverClient)
      .useValue({ fetchPostings })
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
    fetchPostings.mockReset();
  });

  it('normalizes fixture postings and does not reprocess already-seen ones', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token);
    await watchBoard(token, 'acme', 'Acme Corp');

    const postingA = posting({ id: 'p-1', text: 'Backend Engineer' });
    const postingB = posting({
      id: 'p-2',
      text: 'Frontend Engineer',
      categories: { location: 'NYC', commitment: 'Full-time' },
      hostedUrl: 'https://jobs.lever.co/acme/p-2',
    });
    fetchPostings.mockResolvedValue([postingA, postingB]);

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
      employmentType: 'Full-time',
      applicationUrl: 'https://jobs.lever.co/acme/posting-1',
    });
    expect(byTitle('Frontend Engineer')).toMatchObject({ location: ['NYC'] });

    // Same API response again — Lever has no timestamp signal, so the
    // adapter's seen-id set (not a "since" filter) must do the skipping.
    const secondRun = await triggerRun(token);
    expect(secondRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 0,
      jobsCreated: 0,
    });

    // A genuinely new posting alongside the two already-seen ones.
    const postingC = posting({
      id: 'p-3',
      text: 'Platform Engineer',
      hostedUrl: 'https://jobs.lever.co/acme/p-3',
    });
    fetchPostings.mockResolvedValue([postingA, postingB, postingC]);

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
});
