import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { GenericFetchClient, FetchedPage } from '../src/job-postings/generic-fetch/generic-fetch-client';

describe('Job Postings — generic fetch (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const fetchRobotsTxt = jest.fn<Promise<string | null>, [string]>();
  const fetchPage = jest.fn<Promise<FetchedPage>, [string]>();

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  function submit(token: string, body: object) {
    return request(app.getHttpServer())
      .post('/job-postings/fetch-url')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GenericFetchClient)
      .useValue({ fetchRobotsTxt, fetchPage })
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
    fetchRobotsTxt.mockReset();
    fetchPage.mockReset();
  });

  const baseSubmission = {
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Remote',
    url: 'https://jobs.acme.example/backend-engineer',
  };

  it('fetches and normalizes a page when robots.txt allows it', async () => {
    const token = await createUserAndToken('owner@example.com');
    fetchRobotsTxt.mockResolvedValue('User-agent: *\nDisallow: /admin\n');
    fetchPage.mockResolvedValue({ status: 200, ok: true, text: 'We need a backend engineer to build APIs.' });

    const response = await submit(token, baseSubmission);
    expect(response.status).toBe(201);
    expect(response.body.responseBody).toMatchObject({
      status: 'ingested',
      jobPosting: {
        company: 'Acme',
        title: 'Backend Engineer',
        description: 'We need a backend engineer to build APIs.',
        location: ['Remote'],
        applicationUrl: baseSubmission.url,
      },
    });

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(1);
  });

  it('falls back to needs_manual_paste when the page fetch fails, without crashing or retrying', async () => {
    const token = await createUserAndToken('owner@example.com');
    fetchRobotsTxt.mockResolvedValue(null);
    fetchPage.mockRejectedValue(new Error('getaddrinfo ENOTFOUND jobs.acme.example'));

    const response = await submit(token, baseSubmission);
    expect(response.status).toBe(201);
    expect(response.body.responseBody).toMatchObject({ status: 'needs_manual_paste' });
    expect(response.body.responseBody.reason).toContain('Fetch failed');
    expect(fetchPage).toHaveBeenCalledTimes(1);

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(0);
  });

  it('falls back to needs_manual_paste when robots.txt disallows the page, without ever fetching it', async () => {
    const token = await createUserAndToken('owner@example.com');
    fetchRobotsTxt.mockResolvedValue('User-agent: *\nDisallow: /backend-engineer\n');

    const response = await submit(token, baseSubmission);
    expect(response.status).toBe(201);
    expect(response.body.responseBody).toMatchObject({ status: 'needs_manual_paste' });
    expect(response.body.responseBody.reason).toContain('robots.txt');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('refuses linkedin.com with no outbound request of any kind, not even robots.txt', async () => {
    const token = await createUserAndToken('owner@example.com');

    const response = await submit(token, {
      ...baseSubmission,
      url: 'https://www.linkedin.com/jobs/view/12345',
    });

    expect(response.status).toBe(201);
    expect(response.body.responseBody).toMatchObject({ status: 'needs_manual_paste' });
    expect(response.body.responseBody.reason).toContain('linkedin.com');
    expect(fetchRobotsTxt).not.toHaveBeenCalled();
    expect(fetchPage).not.toHaveBeenCalled();

    const postings = await request(app.getHttpServer())
      .get('/job-postings')
      .set('Authorization', `Bearer ${token}`);
    expect(postings.body.responseBody).toHaveLength(0);
  });

  it('refuses glassdoor.com subdomains with no outbound request', async () => {
    const token = await createUserAndToken('owner@example.com');

    const response = await submit(token, {
      ...baseSubmission,
      url: 'https://www.glassdoor.com/job-listing/12345',
    });

    expect(response.body.responseBody).toMatchObject({ status: 'needs_manual_paste' });
    expect(fetchRobotsTxt).not.toHaveBeenCalled();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer())
      .post('/job-postings/fetch-url')
      .send(baseSubmission);
    expect(response.status).toBe(401);
  });
});
