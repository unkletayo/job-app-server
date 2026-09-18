import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = { email: 'user@example.com', password: 'correct-horse-battery-staple' };

  function registerUser(body: { email: string; password: string } = credentials) {
    return request(app.getHttpServer()).post('/auth/register').send(body);
  }

  function loginUser(body: { email: string; password: string } = credentials) {
    return request(app.getHttpServer()).post('/auth/login').send(body);
  }

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
    const response = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ email: credentials.email });
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.password).toBeUndefined();
  });

  it('refuses to register a second user', async () => {
    await registerUser({ email: 'first@example.com', password: 'correct-horse-battery-staple' }).expect(
      201,
    );

    const response = await registerUser({
      email: 'second@example.com',
      password: 'another-password-here',
    });

    expect(response.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await registerUser().expect(201);

    const goodLogin = await loginUser();
    expect(goodLogin.status).toBe(200);
    expect(typeof goodLogin.body.accessToken).toBe('string');

    const badLogin = await loginUser({ email: credentials.email, password: 'wrong-password' });
    expect(badLogin.status).toBe(401);
  });

  it('protects /auth/me and accepts a valid token', async () => {
    await registerUser().expect(201);
    const login = await loginUser();

    const unauthorized = await request(app.getHttpServer()).get('/auth/me');
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(authorized.status).toBe(200);
    expect(authorized.body).toMatchObject({ email: credentials.email });
  });
});
