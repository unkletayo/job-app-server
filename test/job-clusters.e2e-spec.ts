import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

describe('Job Clusters — deduplication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  function submitPaste(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/job-postings/manual-paste')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
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

  const basePosting = {
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Remote',
    description: 'Build and maintain backend services.',
  };

  it('folds two postings matching on company+title+location into one cluster', async () => {
    const token = await createUserAndToken('owner@example.com');

    const first = await submitPaste(token, {
      ...basePosting,
      description: 'First pasted version, from LinkedIn.',
    });
    const second = await submitPaste(token, {
      ...basePosting,
      description: 'Second pasted version, from Glassdoor — worded differently.',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    // Same cluster's canonical Job Posting is reused, not duplicated — the
    // second submission's id equals the first's.
    expect(second.body.responseBody.id).toBe(first.body.responseBody.id);

    const clusters = await request(app.getHttpServer())
      .get('/job-clusters')
      .set('Authorization', `Bearer ${token}`);
    expect(clusters.body.responseBody).toHaveLength(1);
    expect(clusters.body.responseBody[0].sourcePostings).toHaveLength(2);
  });

  it('folds two postings matching on canonical application URL into one cluster, even with different titles', async () => {
    const token = await createUserAndToken('owner@example.com');
    const url = 'https://boards.greenhouse.io/acme/jobs/12345';

    const first = await submitPaste(token, { ...basePosting, url });
    const second = await submitPaste(token, {
      ...basePosting,
      title: 'Backend Engineer (Senior)',
      url,
    });

    expect(second.body.responseBody.id).toBe(first.body.responseBody.id);

    const clusters = await request(app.getHttpServer())
      .get('/job-clusters')
      .set('Authorization', `Bearer ${token}`);
    expect(clusters.body.responseBody).toHaveLength(1);
  });

  it('does not merge postings that fail every dedup signal — no over-merging', async () => {
    const token = await createUserAndToken('owner@example.com');

    const first = await submitPaste(token, basePosting);
    const second = await submitPaste(token, {
      ...basePosting,
      company: 'A Totally Different Company',
      title: 'Frontend Engineer',
      location: 'New York',
    });

    expect(second.body.responseBody.id).not.toBe(first.body.responseBody.id);

    const clusters = await request(app.getHttpServer())
      .get('/job-clusters')
      .set('Authorization', `Bearer ${token}`);
    expect(clusters.body.responseBody).toHaveLength(2);
    expect(clusters.body.responseBody.every((cluster: { sourcePostings: unknown[] }) => cluster.sourcePostings.length === 1)).toBe(true);
  });

  it('exposes which Source Postings make up a cluster via cluster detail', async () => {
    const token = await createUserAndToken('owner@example.com');

    await submitPaste(token, { ...basePosting, description: 'First.' });
    await submitPaste(token, { ...basePosting, description: 'Second.' });

    const clusters = await request(app.getHttpServer())
      .get('/job-clusters')
      .set('Authorization', `Bearer ${token}`);
    const clusterId = clusters.body.responseBody[0].id as string;

    const detail = await request(app.getHttpServer())
      .get(`/job-clusters/${clusterId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body.responseBody.sourcePostings).toHaveLength(2);
    expect(detail.body.responseBody.jobPosting).toBeDefined();
    expect(detail.body.responseBody.jobPosting.company).toBe('Acme');
  });

  it('never lets one user read another user’s job cluster', async () => {
    const ownerToken = await createUserAndToken('owner@example.com');
    const intruderToken = await createUserAndToken('intruder@example.com');

    await submitPaste(ownerToken, basePosting);
    const clusters = await request(app.getHttpServer())
      .get('/job-clusters')
      .set('Authorization', `Bearer ${ownerToken}`);
    const clusterId = clusters.body.responseBody[0].id as string;

    const asIntruder = await request(app.getHttpServer())
      .get(`/job-clusters/${clusterId}`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(asIntruder.status).toBe(404);
  });
});
