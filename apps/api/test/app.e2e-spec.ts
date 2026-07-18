// Boots the full AppModule against the CI test database and smoke-tests
// public health endpoints plus auth enforcement on protected routes.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PROCESS_ROLE = 'api';
process.env.DISABLE_CRON_JOBS = 'true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App smoke (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns healthy', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/v1/health/ready returns 200 when DB reachable', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
  });

  it('rejects unauthenticated access to tenant data', async () => {
    await request(app.getHttpServer()).get('/api/v1/assets').expect(401);
  });

  it('rejects unauthenticated access to owner console APIs', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/system').expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/agent-enrollments').expect(401);
    await request(app.getHttpServer()).get('/api/v1/product-licenses/summary').expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/updates/owner-status').expect(401);
  });

  it('rejects unauthenticated agent endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/discovery/agents').expect(401);
  });
});
