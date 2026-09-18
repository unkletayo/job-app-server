import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('registers the first local user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'correct-horse-battery-staple' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ email: 'user@example.com' });
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.password).toBeUndefined();
  });

  it('refuses to register a second user', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'correct-horse-battery-staple' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'another-password-here' });

    expect(response.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'correct-horse-battery-staple' })
      .expect(201);

    const goodLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'correct-horse-battery-staple' });

    expect(goodLogin.status).toBe(200);
    expect(typeof goodLogin.body.accessToken).toBe('string');

    const badLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'wrong-password' });

    expect(badLogin.status).toBe(401);
  });

  it('protects /auth/me and accepts a valid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'correct-horse-battery-staple' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'correct-horse-battery-staple' });

    const unauthorized = await request(app.getHttpServer()).get('/auth/me');
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(authorized.status).toBe(200);
    expect(authorized.body).toMatchObject({ email: 'user@example.com' });
  });
});
