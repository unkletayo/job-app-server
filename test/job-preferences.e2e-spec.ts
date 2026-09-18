import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

describe('Job Preferences (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  async function createUserAndToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return jwt.sign({ sub: user.id, email: user.email });
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

  it('returns all-defaults on first read, before any update', async () => {
    const token = await createUserAndToken('owner@example.com');

    const response = await request(app.getHttpServer())
      .get('/job-preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.responseBody).toMatchObject({
      targetRoles: [],
      seniority: [],
      locations: [],
      remotePreference: false,
      hybridPreference: false,
      minimumSalaryAmount: null,
      minimumSalaryCurrency: null,
      employmentTypes: [],
      requiredTechnologies: [],
      preferredTechnologies: [],
      excludedCompanies: [],
      excludedTitles: [],
      keywords: [],
      negativeKeywords: [],
    });
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer()).get('/job-preferences');
    expect(response.status).toBe(401);
  });

  it('updates every preference category and is immediately visible on the next read', async () => {
    const token = await createUserAndToken('owner@example.com');

    const update = await request(app.getHttpServer())
      .patch('/job-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetRoles: ['Backend Engineer'],
        seniority: ['Senior'],
        locations: ['Remote'],
        remotePreference: true,
        hybridPreference: false,
        minimumSalaryAmount: 90000,
        minimumSalaryCurrency: 'USD',
        employmentTypes: ['full_time'],
        requiredTechnologies: ['TypeScript'],
        preferredTechnologies: ['Rust'],
        excludedCompanies: ['Blocked Co'],
        excludedTitles: ['Sales Manager'],
        keywords: ['distributed systems'],
        negativeKeywords: ['unpaid'],
      });

    expect(update.status).toBe(200);
    expect(update.body.responseBody).toMatchObject({
      targetRoles: ['Backend Engineer'],
      seniority: ['Senior'],
      locations: ['Remote'],
      remotePreference: true,
      hybridPreference: false,
      minimumSalaryAmount: 90000,
      minimumSalaryCurrency: 'USD',
      employmentTypes: ['full_time'],
      requiredTechnologies: ['TypeScript'],
      preferredTechnologies: ['Rust'],
      excludedCompanies: ['Blocked Co'],
      excludedTitles: ['Sales Manager'],
      keywords: ['distributed systems'],
      negativeKeywords: ['unpaid'],
    });

    const read = await request(app.getHttpServer())
      .get('/job-preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(read.body.responseBody).toMatchObject({ targetRoles: ['Backend Engineer'], remotePreference: true });
  });

  // This resource has no :id in its URL — ownership comes entirely from the
  // JWT, so there's no request shape an "intruder" could even send to name
  // another user's row (unlike the entry sections in ticket 02, which have
  // a real cross-user id-guessing surface a 404 defends against). Isolation,
  // proven here, is the correct equivalent of a rejection test for this shape.
  it('never lets one user see or change another user’s preferences', async () => {
    const ownerToken = await createUserAndToken('owner@example.com');
    const intruderToken = await createUserAndToken('intruder@example.com');

    await request(app.getHttpServer())
      .patch('/job-preferences')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetRoles: ['Backend Engineer'] })
      .expect(200);

    const intruderRead = await request(app.getHttpServer())
      .get('/job-preferences')
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(intruderRead.body.responseBody.targetRoles).toEqual([]);

    await request(app.getHttpServer())
      .patch('/job-preferences')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ targetRoles: ['Sales'] })
      .expect(200);

    const ownerRead = await request(app.getHttpServer())
      .get('/job-preferences')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRead.body.responseBody.targetRoles).toEqual(['Backend Engineer']);
  });
});
