import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

describe('Watched companies (e2e)', () => {
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

  it('creates, lists, and deletes a watched company', async () => {
    const token = await createUserAndToken('owner@example.com');

    const create = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'greenhouse', boardToken: 'acme', label: 'Acme Corp' });
    expect(create.status).toBe(201);
    const id = create.body.responseBody.id as string;

    const list = await request(app.getHttpServer())
      .get('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.responseBody).toHaveLength(1);
    expect(list.body.responseBody[0]).toMatchObject({
      source: 'greenhouse',
      boardToken: 'acme',
      label: 'Acme Corp',
      enabled: true,
    });

    const remove = await request(app.getHttpServer())
      .delete(`/discovery/watched-companies/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.status).toBe(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`);
    expect(listAfterDelete.body.responseBody).toEqual([]);
  });

  it('rejects an unsupported source', async () => {
    const token = await createUserAndToken('owner@example.com');

    const create = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'workday', boardToken: 'acme', label: 'Acme Corp' });
    expect(create.status).toBe(400);
  });

  it('rejects watching the same board on the same source twice', async () => {
    const token = await createUserAndToken('owner@example.com');

    await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'lever', boardToken: 'acme', label: 'Acme Corp' });

    const duplicate = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'lever', boardToken: 'acme', label: 'Acme Corp (again)' });
    expect(duplicate.status).toBe(409);
  });

  it('never lets one user see or delete another user’s watched company', async () => {
    const ownerToken = await createUserAndToken('owner@example.com');
    const intruderToken = await createUserAndToken('intruder@example.com');

    const create = await request(app.getHttpServer())
      .post('/discovery/watched-companies')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ source: 'greenhouse', boardToken: 'acme', label: 'Acme Corp' });
    const id = create.body.responseBody.id as string;

    const listAsIntruder = await request(app.getHttpServer())
      .get('/discovery/watched-companies')
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(listAsIntruder.body.responseBody).toEqual([]);

    const deleteAsIntruder = await request(app.getHttpServer())
      .delete(`/discovery/watched-companies/${id}`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(deleteAsIntruder.status).toBe(404);
  });

  it('rejects requests with no token', async () => {
    const response = await request(app.getHttpServer()).get('/discovery/watched-companies');
    expect(response.status).toBe(401);
  });
});
