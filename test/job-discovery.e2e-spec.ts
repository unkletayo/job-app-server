import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { DISCOVERY_ADAPTERS } from '../src/job-discovery/discoverable-source-adapter';
import { FakeSourceAdapter, FailingSourceAdapter } from './support/fake-source-adapter';

// Discovery runs make several real Postgres round-trips per posting and,
// for 'fake', page across multiple fetchPage calls — each gated by
// DiscoveryRateLimiterService. That's genuine, correct throttling behavior,
// not test slack, so tests configure a fast per-minute budget for 'fake'
// (see configureFastThrottle) rather than fighting jest's default 5s
// per-test timeout; this bump is just headroom for the real DB I/O.
jest.setTimeout(15000);

describe('Job Discovery — scheduler + adapter harness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  // DiscoveryRateLimiterService is a singleton keyed by sourceKey, so
  // 'fake's default 30/min throttle would otherwise force real multi-second
  // sleeps between this file's tests. requestsPerMinute is a genuine
  // per-source config knob (DiscoveryController's PATCH), so tests just set
  // it high rather than bypassing the rate limiter.
  async function configureFastThrottle(token: string, sourceKey: string): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/discovery/sources/${sourceKey}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ requestsPerMinute: 6000 });
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DISCOVERY_ADAPTERS)
      .useValue({
        fake: new FakeSourceAdapter(3),
        failing: new FailingSourceAdapter(),
      })
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
  });

  it('discovers, paginates, and ingests every posting from a fake source, with the outcome queryable', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token, 'fake');

    const run = await request(app.getHttpServer())
      .post('/discovery/sources/fake/run')
      .set('Authorization', `Bearer ${token}`);

    expect(run.status).toBe(201);
    expect(run.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 3,
      jobsCreated: 3,
      jobsMerged: 0,
      failureCount: 0,
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(3);
    expect(postings.body.responseBody.map((p: { title: string }) => p.title).sort()).toEqual([
      'Fake Engineer 1',
      'Fake Engineer 2',
      'Fake Engineer 3',
    ]);

    const sources = await request(app.getHttpServer())
      .get('/discovery/sources')
      .set('Authorization', `Bearer ${token}`);
    const fakeSource = sources.body.responseBody.find(
      (s: { sourceKey: string }) => s.sourceKey === 'fake',
    );
    expect(fakeSource.lastSeenJobId).toBe('fake-job-3');
    expect(fakeSource.lastCursor).toBeNull();
    expect(fakeSource.lastSuccessfulRunAt).not.toBeNull();

    const runs = await request(app.getHttpServer())
      .get('/discovery/runs')
      .set('Authorization', `Bearer ${token}`);
    expect(runs.body.responseBody).toHaveLength(1);
    expect(runs.body.responseBody[0]).toMatchObject({ status: 'succeeded', jobsCreated: 3 });
  });

  it('does not reprocess already-seen postings on a second run', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token, 'fake');

    await request(app.getHttpServer())
      .post('/discovery/sources/fake/run')
      .set('Authorization', `Bearer ${token}`);

    const secondRun = await request(app.getHttpServer())
      .post('/discovery/sources/fake/run')
      .set('Authorization', `Bearer ${token}`);

    expect(secondRun.body.responseBody).toMatchObject({
      status: 'succeeded',
      jobsFetched: 0,
      jobsCreated: 0,
      jobsMerged: 0,
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(3);
  });

  it('isolates a failing source from the rest of the discovery cycle and keeps the app responsive', async () => {
    const token = await createUserAndToken('owner@example.com');
    await configureFastThrottle(token, 'fake');

    const cycle = await request(app.getHttpServer())
      .post('/discovery/run')
      .set('Authorization', `Bearer ${token}`);
    expect(cycle.status).toBe(201);

    const runs = await request(app.getHttpServer())
      .get('/discovery/runs')
      .set('Authorization', `Bearer ${token}`);

    const bySourceKey = (key: string) =>
      runs.body.responseBody.find((r: { source: { sourceKey: string } }) => r.source.sourceKey === key);

    expect(bySourceKey('fake')).toMatchObject({ status: 'succeeded', jobsCreated: 3 });
    expect(bySourceKey('failing')).toMatchObject({ status: 'failed' });
    expect(bySourceKey('failing').errorMessage).toContain('simulated adapter outage');

    // Proves the failure didn't crash the app: it's still serving requests.
    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.status).toBe(200);
    expect(postings.body.responseBody).toHaveLength(3);
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer()).get('/discovery/sources');
    expect(response.status).toBe(401);
  });
});
