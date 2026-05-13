// =============================================================================
// CCM API — Activity Master Routes Unit Tests
//
// Uses supertest with a minimal Express app. Service layer is fully mocked.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mock logger and config before anything else resolves
// ---------------------------------------------------------------------------

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
  }),
}));

vi.mock('../../../config/index', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'error',
    postgresHost: 'localhost',
    postgresPort: 5432,
    postgresDb: 'ccm_test',
    postgresUser: 'ccm',
    postgresPassword: 'ccm',
    postgresPoolMin: 2,
    postgresPoolMax: 10,
    mongoHost: 'localhost',
    mongoPort: 27017,
    mongoDb: 'ccm_test',
    mongoUser: 'ccm',
    mongoPassword: 'ccm',
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiry: '8h',
    corsAllowedOrigins: 'http://localhost:5173',
  },
}));

// ---------------------------------------------------------------------------
// Mock the service before importing the router
// ---------------------------------------------------------------------------

vi.mock('../activity-master.service', () => ({
  listActivitiesService:       vi.fn().mockResolvedValue([]),
  listActiveActivitiesService: vi.fn().mockResolvedValue([]),
  createActivityService:       vi.fn(),
  updateActivityService:       vi.fn(),
}));

import * as svc from '../activity-master.service';
import { activityMasterRouter } from '../activity-master.routes';
import { errorHandler } from '../../../shared/middleware/errorHandler';
import { csrfProtection } from '../../../shared/middleware/csrf';
import { AppError } from '../../../shared/errors/AppError';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockListActivitiesService       = svc.listActivitiesService       as MockedFunction<typeof svc.listActivitiesService>;
const mockListActiveActivitiesService = svc.listActiveActivitiesService as MockedFunction<typeof svc.listActiveActivitiesService>;
const mockCreateActivityService       = svc.createActivityService       as MockedFunction<typeof svc.createActivityService>;
const mockUpdateActivityService       = svc.updateActivityService       as MockedFunction<typeof svc.updateActivityService>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TEST_CSRF_TOKEN = 'test-csrf-token-abc123';

function makeJwt() {
  return jwt.sign(
    { userId: 'user-001', username: 'agent1', roles: ['agent'] },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function authCookies(): string {
  return `ccm_session=${makeJwt()}; ccm-csrf=${TEST_CSRF_TOKEN}`;
}

// ---------------------------------------------------------------------------
// Minimal Express app
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req, _res, next) => {
    req.correlationId = 'test-correlation-id';
    next();
  });

  app.use(csrfProtection);

  // Stub authenticate
  app.use((req, _res, next) => {
    const token = req.cookies?.['ccm_session'] as string | undefined;
    if (!token) return next(AppError.unauthorized('No session cookie present'));
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as {
        userId: string; username: string; roles: string[];
      };
      req.user = { userId: decoded.userId, username: decoded.username, roles: decoded.roles };
      next();
    } catch {
      return next(AppError.unauthorized('Invalid session'));
    }
  });

  app.use('/api/v1/activity-master', activityMasterRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const MOCK_ACTIVITY_DTO = {
  id:          '507f1f77bcf86cd799439011',
  code:        'CALL_LOG',
  displayName: 'Call Logging',
  description: 'Log an inbound call',
  isActive:    true,
  createdBy:   'user-001',
  updatedBy:   'user-001',
  createdAt:   '2026-03-25T00:00:00.000Z',
  updatedAt:   '2026-03-25T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  vi.resetAllMocks();
  mockListActivitiesService.mockResolvedValue([]);
  mockListActiveActivitiesService.mockResolvedValue([]);
  app = buildApp();
});

// ---------------------------------------------------------------------------
// GET /api/v1/activity-master
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-master', () => {
  it('200 with data array (empty)', async () => {
    const res = await request(app)
      .get('/api/v1/activity-master')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('200 with populated data array', async () => {
    mockListActivitiesService.mockResolvedValue([MOCK_ACTIVITY_DTO]);

    const res = await request(app)
      .get('/api/v1/activity-master')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].code).toBe('CALL_LOG');
  });

  it('without auth → 401', async () => {
    const res = await request(app).get('/api/v1/activity-master');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/activity-master/active
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-master/active', () => {
  it('200 with data array', async () => {
    mockListActiveActivitiesService.mockResolvedValue([MOCK_ACTIVITY_DTO]);

    const res = await request(app)
      .get('/api/v1/activity-master/active')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/activity-master
// ---------------------------------------------------------------------------

describe('POST /api/v1/activity-master', () => {
  it('201 on valid body', async () => {
    mockCreateActivityService.mockResolvedValue(MOCK_ACTIVITY_DTO);

    const res = await request(app)
      .post('/api/v1/activity-master')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ code: 'CALL_LOG', displayName: 'Call Logging' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('CALL_LOG');
  });

  it('422 on missing code', async () => {
    const res = await request(app)
      .post('/api/v1/activity-master')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ displayName: 'Call Logging' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 on missing displayName', async () => {
    const res = await request(app)
      .post('/api/v1/activity-master')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ code: 'CALL_LOG' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('without CSRF header → 403', async () => {
    const res = await request(app)
      .post('/api/v1/activity-master')
      .set('Cookie', `ccm_session=${makeJwt()}`)
      .send({ code: 'CALL_LOG', displayName: 'Call Logging' });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/activity-master/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/activity-master/:id', () => {
  it('200 on valid body and valid ObjectId', async () => {
    mockUpdateActivityService.mockResolvedValue({ ...MOCK_ACTIVITY_DTO, displayName: 'Updated' });

    const res = await request(app)
      .patch('/api/v1/activity-master/507f1f77bcf86cd799439011')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ displayName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.displayName).toBe('Updated');
  });

  it('400 on invalid ObjectId', async () => {
    const res = await request(app)
      .patch('/api/v1/activity-master/not-an-objectid')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ displayName: 'Updated' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 when service throws not found', async () => {
    mockUpdateActivityService.mockRejectedValue(
      new AppError('NOT_FOUND', "Activity '507f1f77bcf86cd799439099' not found", 404),
    );

    const res = await request(app)
      .patch('/api/v1/activity-master/507f1f77bcf86cd799439099')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send({ displayName: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
