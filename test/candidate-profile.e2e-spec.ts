import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

interface SectionCase {
  section: string;
  createPayload: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
  updatedField: string;
}

const sections: SectionCase[] = [
  {
    section: 'experience',
    createPayload: { company: 'Acme', title: 'Engineer', startDate: '2020-01-01' },
    updatePayload: { title: 'Senior Engineer' },
    updatedField: 'title',
  },
  {
    section: 'education',
    createPayload: { institution: 'State University', degree: 'BSc' },
    updatePayload: { degree: 'MSc' },
    updatedField: 'degree',
  },
  {
    section: 'certification',
    createPayload: { name: 'AWS SAA', issuer: 'AWS' },
    updatePayload: { name: 'AWS SAP' },
    updatedField: 'name',
  },
  {
    section: 'skill',
    createPayload: { name: 'TypeScript' },
    updatePayload: { name: 'Rust' },
    updatedField: 'name',
  },
  {
    section: 'project',
    createPayload: { name: 'Job App', technologies: ['NestJS'] },
    updatePayload: { name: 'Job App v2' },
    updatedField: 'name',
  },
  {
    section: 'achievement',
    createPayload: { description: 'Shipped v1' },
    updatePayload: { description: 'Shipped v2' },
    updatedField: 'description',
  },
  {
    section: 'link',
    createPayload: { label: 'GitHub', url: 'https://github.com/example' },
    updatePayload: { label: 'GitHub profile' },
    updatedField: 'label',
  },
];

describe('Candidate Profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let token: string;
  let otherUserToken: string;

  async function createOwnerAndToken(): Promise<string> {
    const passwordHash = await bcrypt.hash('correct-horse-battery-staple', 4);
    const user = await prisma.user.create({
      data: { email: 'owner@example.com', passwordHash },
    });
    return jwt.sign({ sub: user.id, email: user.email });
  }

  async function createOtherUserAndToken(): Promise<string> {
    const passwordHash = await bcrypt.hash('another-password-here', 4);
    const user = await prisma.user.create({
      data: { email: 'intruder@example.com', passwordHash },
    });
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
    token = await createOwnerAndToken();
    otherUserToken = await createOtherUserAndToken();
  });

  describe('flat profile', () => {
    it('is not found before creation, then upserts and reads back', async () => {
      const beforeCreate = await request(app.getHttpServer())
        .get('/candidate-profile')
        .set('Authorization', `Bearer ${token}`);
      expect(beforeCreate.status).toBe(404);

      const upsert = await request(app.getHttpServer())
        .put('/candidate-profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Ada Lovelace', location: 'London' });
      expect(upsert.status).toBe(200);
      expect(upsert.body.responseBody).toMatchObject({ fullName: 'Ada Lovelace', location: 'London' });

      const afterCreate = await request(app.getHttpServer())
        .get('/candidate-profile')
        .set('Authorization', `Bearer ${token}`);
      expect(afterCreate.status).toBe(200);
      expect(afterCreate.body.responseBody).toMatchObject({ fullName: 'Ada Lovelace' });
    });

    it('rejects requests with no token', async () => {
      const response = await request(app.getHttpServer()).get('/candidate-profile');
      expect(response.status).toBe(401);
    });
  });

  describe.each(sections)('$section section', ({ section, createPayload, updatePayload, updatedField }) => {
    it('creates, edits, and deletes an entry, with provenance set', async () => {
      const create = await request(app.getHttpServer())
        .post(`/candidate-profile/${section}`)
        .set('Authorization', `Bearer ${token}`)
        .send(createPayload);

      expect(create.status).toBe(201);
      expect(create.body.responseBody).toMatchObject({
        source: 'user_profile',
        verified: true,
      });
      expect(create.body.responseBody.lastUpdated).toBeDefined();
      const id = create.body.responseBody.id as string;

      const list = await request(app.getHttpServer())
        .get(`/candidate-profile/${section}`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.responseBody).toHaveLength(1);

      const update = await request(app.getHttpServer())
        .patch(`/candidate-profile/${section}/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);
      expect(update.status).toBe(200);
      expect(update.body.responseBody[updatedField]).toBe(updatePayload[updatedField]);

      const remove = await request(app.getHttpServer())
        .delete(`/candidate-profile/${section}/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(remove.status).toBe(204);

      const afterDelete = await request(app.getHttpServer())
        .get(`/candidate-profile/${section}/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(afterDelete.status).toBe(404);
    });
  });

  it('never lets one user read, edit, or delete another user’s entry', async () => {
    const create = await request(app.getHttpServer())
      .post('/candidate-profile/experience')
      .set('Authorization', `Bearer ${token}`)
      .send({ company: 'Acme', title: 'Engineer', startDate: '2020-01-01' });
    const id = create.body.responseBody.id as string;

    const readAsIntruder = await request(app.getHttpServer())
      .get(`/candidate-profile/experience/${id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    expect(readAsIntruder.status).toBe(404);

    const updateAsIntruder = await request(app.getHttpServer())
      .patch(`/candidate-profile/experience/${id}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ title: 'Hijacked' });
    expect(updateAsIntruder.status).toBe(404);

    const deleteAsIntruder = await request(app.getHttpServer())
      .delete(`/candidate-profile/experience/${id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    expect(deleteAsIntruder.status).toBe(404);

    const stillThere = await request(app.getHttpServer())
      .get(`/candidate-profile/experience/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(stillThere.status).toBe(200);
  });
});
