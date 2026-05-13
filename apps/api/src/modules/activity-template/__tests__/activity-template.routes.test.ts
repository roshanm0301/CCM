// =============================================================================
// CCM API — Activity Template Routes Unit Tests
//
// Uses supertest with a minimal Express app. Service layer is fully mocked.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–7
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
// Mock the service module before importing the router
// ---------------------------------------------------------------------------

vi.mock('../activity-template.service', () => ({
  listTemplatesService:               vi.fn().mockResolvedValue([]),
  getTemplateService:                 vi.fn(),
  createTemplateService:              vi.fn(),
  updateTemplateService:              vi.fn(),
  listDepartmentsForTemplateService:  vi.fn().mockResolvedValue([]),
  listProductTypesForTemplateService: vi.fn().mockResolvedValue([]),  // Fix 12: async
  listAppliesToService:               vi.fn().mockResolvedValue([]),
  listRolesService:                   vi.fn().mockResolvedValue([]),
  getApplicableTemplateService:       vi.fn(),
}));

import * as svc from '../activity-template.service';
import { activityTemplateRouter } from '../activity-template.routes';
import { errorHandler } from '../../../shared/middleware/errorHandler';
import { csrfProtection } from '../../../shared/middleware/csrf';
import { AppError } from '../../../shared/errors/AppError';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockListTemplatesService               = svc.listTemplatesService               as MockedFunction<typeof svc.listTemplatesService>;
const mockGetTemplateService                 = svc.getTemplateService                 as MockedFunction<typeof svc.getTemplateService>;
const mockCreateTemplateService              = svc.createTemplateService              as MockedFunction<typeof svc.createTemplateService>;
const mockUpdateTemplateService              = svc.updateTemplateService              as MockedFunction<typeof svc.updateTemplateService>;
const mockListProductTypesForTemplateService = svc.listProductTypesForTemplateService as MockedFunction<typeof svc.listProductTypesForTemplateService>;
const mockListAppliesToService               = svc.listAppliesToService               as MockedFunction<typeof svc.listAppliesToService>;
const mockListRolesService                   = svc.listRolesService                   as MockedFunction<typeof svc.listRolesService>;
const mockGetApplicableTemplateService       = svc.getApplicableTemplateService       as MockedFunction<typeof svc.getApplicableTemplateService>;

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

  app.use('/api/v1/activity-templates', activityTemplateRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const MOCK_TEMPLATE_DTO = {
  id:           '507f1f77bcf86cd799439021',
  templateName: 'Complaint Flow',
  appliesTo:    'complaint',
  department:   'SALES',
  productType:  'Motorcycle',
  isActive:     true,
  createdBy:    'user-001',
  updatedBy:    'user-001',
  createdAt:    '2026-03-25T00:00:00.000Z',
  updatedAt:    '2026-03-25T00:00:00.000Z',
  steps:        [],
};

/** Valid minimal body for creating a template (isActive defaults) */
function validCreateBody() {
  return {
    templateName: 'Complaint Flow',
    appliesTo:    'complaint',
    department:   'SALES',
    productType:  'Motorcycle',
  };
}

/** Valid full body for updating (Fix 7: isActive + steps required) */
function validUpdateBody() {
  return {
    templateName: 'Complaint Flow',
    appliesTo:    'complaint',
    department:   'SALES',
    productType:  'Motorcycle',
    isActive:     true,
    steps:        [],
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  vi.resetAllMocks();
  mockListTemplatesService.mockResolvedValue([]);
  mockListProductTypesForTemplateService.mockResolvedValue([]);
  mockListAppliesToService.mockResolvedValue([]);
  mockListRolesService.mockResolvedValue([]);
  app = buildApp();
});

// ---------------------------------------------------------------------------
// GET /api/v1/activity-templates
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-templates', () => {
  it('200 with data array', async () => {
    mockListTemplatesService.mockResolvedValue([MOCK_TEMPLATE_DTO]);

    const res = await request(app)
      .get('/api/v1/activity-templates')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('without auth → 401', async () => {
    const res = await request(app).get('/api/v1/activity-templates');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/activity-templates/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-templates/:id', () => {
  it('200 for valid ObjectId', async () => {
    mockGetTemplateService.mockResolvedValue(MOCK_TEMPLATE_DTO as any);

    const res = await request(app)
      .get('/api/v1/activity-templates/507f1f77bcf86cd799439021')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('507f1f77bcf86cd799439021');
  });

  it('400 for invalid ObjectId', async () => {
    const res = await request(app)
      .get('/api/v1/activity-templates/not-an-objectid')
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 when template not found', async () => {
    mockGetTemplateService.mockRejectedValue(
      new AppError('NOT_FOUND', "Activity Template '507f1f77bcf86cd799439099' not found", 404),
    );

    const res = await request(app)
      .get('/api/v1/activity-templates/507f1f77bcf86cd799439099')
      .set('Cookie', authCookies());

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/activity-templates
// ---------------------------------------------------------------------------

describe('POST /api/v1/activity-templates', () => {
  it('201 on valid body', async () => {
    mockCreateTemplateService.mockResolvedValue(MOCK_TEMPLATE_DTO as any);

    const res = await request(app)
      .post('/api/v1/activity-templates')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(validCreateBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.templateName).toBe('Complaint Flow');
  });

  it('422 on missing templateName', async () => {
    const { templateName: _omit, ...body } = validCreateBody();

    const res = await request(app)
      .post('/api/v1/activity-templates')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 on missing appliesTo', async () => {
    const { appliesTo: _omit, ...body } = validCreateBody();

    const res = await request(app)
      .post('/api/v1/activity-templates')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(body);

    expect(res.status).toBe(422);
  });

  it('without CSRF → 403', async () => {
    const res = await request(app)
      .post('/api/v1/activity-templates')
      .set('Cookie', `ccm_session=${makeJwt()}`)
      .send(validCreateBody());

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/activity-templates/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/activity-templates/:id', () => {
  it('200 on valid body', async () => {
    mockUpdateTemplateService.mockResolvedValue(MOCK_TEMPLATE_DTO as any);

    const res = await request(app)
      .patch('/api/v1/activity-templates/507f1f77bcf86cd799439021')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(validUpdateBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('400 on invalid ObjectId', async () => {
    const res = await request(app)
      .patch('/api/v1/activity-templates/not-an-objectid')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(validUpdateBody());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Fix 7: 422 when isActive missing from update body', async () => {
    const { isActive: _omit, ...body } = validUpdateBody();

    const res = await request(app)
      .patch('/api/v1/activity-templates/507f1f77bcf86cd799439021')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Fix 7: 422 when steps missing from update body', async () => {
    const { steps: _omit, ...body } = validUpdateBody();

    const res = await request(app)
      .patch('/api/v1/activity-templates/507f1f77bcf86cd799439021')
      .set('Cookie', authCookies())
      .set('X-CSRF-Token', TEST_CSRF_TOKEN)
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Lookup endpoints
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-templates/lookups/product-types', () => {
  it('200 (now async — Fix 12)', async () => {
    mockListProductTypesForTemplateService.mockResolvedValue([
      { code: 'Motorcycle', label: 'Motorcycle' },
    ]);

    const res = await request(app)
      .get('/api/v1/activity-templates/lookups/product-types')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/activity-templates/lookups/applies-to', () => {
  it('200', async () => {
    mockListAppliesToService.mockResolvedValue([
      { code: 'complaint', label: 'Complaint' },
    ]);

    const res = await request(app)
      .get('/api/v1/activity-templates/lookups/applies-to')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/activity-templates/lookups/roles', () => {
  it('200', async () => {
    mockListRolesService.mockResolvedValue([
      { code: 'ccm_agent', label: 'CCM Agent' },
    ]);

    const res = await request(app)
      .get('/api/v1/activity-templates/lookups/roles')
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].code).toBe('ccm_agent');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/activity-templates/applicable
// ---------------------------------------------------------------------------

describe('GET /api/v1/activity-templates/applicable', () => {
  it('all three query params and mock returns template → 200', async () => {
    mockGetApplicableTemplateService.mockResolvedValue(MOCK_TEMPLATE_DTO as any);

    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', department: 'SALES', productType: 'Motorcycle' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('507f1f77bcf86cd799439021');
  });

  it('missing appliesTo param → 400', async () => {
    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ department: 'SALES', productType: 'Motorcycle' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
  });

  it('missing department param → 400', async () => {
    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', productType: 'Motorcycle' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
  });

  it('missing productType param → 400', async () => {
    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', department: 'SALES' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
  });

  it('mock service throws 404 → route returns 404', async () => {
    mockGetApplicableTemplateService.mockRejectedValue(
      new AppError('NOT_FOUND', 'No active template found for the selected context.', 404),
    );

    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', department: 'SALES', productType: 'Motorcycle' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(404);
  });

  it('mock service throws 409 → route returns 409', async () => {
    mockGetApplicableTemplateService.mockRejectedValue(
      new AppError('CONFLICT', 'More than one active template found for the selected context.', 409),
    );

    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', department: 'SALES', productType: 'Motorcycle' })
      .set('Cookie', authCookies());

    expect(res.status).toBe(409);
  });

  it('no auth cookie → 401', async () => {
    const res = await request(app)
      .get('/api/v1/activity-templates/applicable')
      .query({ appliesTo: 'complaint', department: 'SALES', productType: 'Motorcycle' });

    expect(res.status).toBe(401);
  });
});
