// =============================================================================
// CCM API — Dealers Routes Integration Tests
//
// Tests HTTP routing, auth enforcement, query-parameter validation, and
// response shape using a minimal Express app. The repository layer is fully
// mocked so no database connection is required.
// Source: CCM Phase 4 Case Creation Workspace spec.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mock config first — errorHandler transitively imports config at module-load
// time, so env vars must be provided before any import resolves.
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
// Mock the dealers repository before importing anything that loads it
// ---------------------------------------------------------------------------

vi.mock('../dealers.repository', () => ({
  searchDealers: vi.fn(),
  countActiveDealersForProductType: vi.fn(),
}));

import * as dealerRepo from '../dealers.repository';
import type { MockedFunction } from 'vitest';
import { dealersRouter } from '../dealers.routes';
import { errorHandler } from '../../../shared/middleware/errorHandler';
import { csrfProtection } from '../../../shared/middleware/csrf';
import { AppError } from '../../../shared/errors/AppError';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockSearchDealers = dealerRepo.searchDealers as MockedFunction<typeof dealerRepo.searchDealers>;
const mockCountActiveDealers = dealerRepo.countActiveDealersForProductType as MockedFunction<typeof dealerRepo.countActiveDealersForProductType>;

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const TEST_CSRF_TOKEN = 'test-csrf-token-abc123';

// ---------------------------------------------------------------------------
// Helper: create a signed JWT
// ---------------------------------------------------------------------------

function makeJwt(overrides?: Partial<{ userId: string; username: string; roles: string[] }>) {
  return jwt.sign(
    {
      userId: overrides?.userId ?? 'user-001',
      username: overrides?.username ?? 'agent1',
      roles: overrides?.roles ?? ['agent'],
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ---------------------------------------------------------------------------
// Helper: build cookie string with auth + CSRF tokens
// ---------------------------------------------------------------------------

function authCookies(): string {
  return `ccm_session=${makeJwt()}; ccm-csrf=${TEST_CSRF_TOKEN}`;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDealerDoc(overrides?: Record<string, unknown>) {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd799439050'),
    dealerCode: 'DLR-001',
    dealerName: 'ABC Motors',
    branchCode: 'BR-001',
    branchName: 'Main Branch',
    contactNumber: '9876543210',
    address: '123 Main Street',
    state: 'Maharashtra',
    city: 'Mumbai',
    pinCode: '400001',
    isActive: true,
    productTypes: ['Motorcycle'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal test Express application
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Correlation ID — required by errorHandler
  app.use((req, _res, next) => {
    req.correlationId = 'test-correlation-id';
    next();
  });

  // CSRF protection (mirrors app.ts)
  app.use(csrfProtection);

  // Stub authenticate — validates JWT cookie and attaches req.user
  app.use((req, _res, next) => {
    const token = req.cookies?.['ccm_session'] as string | undefined;
    if (!token) {
      return next(AppError.unauthorized('No session cookie present'));
    }
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as {
        userId: string;
        username: string;
        roles: string[];
      };
      req.user = { userId: decoded.userId, username: decoded.username, roles: decoded.roles };
      next();
    } catch {
      return next(AppError.unauthorized('Invalid session'));
    }
  });

  app.use('/api/v1/dealers', dealersRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  vi.resetAllMocks();
  app = buildApp();
});

// ---------------------------------------------------------------------------
// Authentication guard
// ---------------------------------------------------------------------------

describe('Authentication guard', () => {
  it('GET /api/v1/dealers without auth cookie → 401', async () => {
    const res = await request(app)
      .get('/api/v1/dealers')
      .query({ productType: 'Motorcycle' });

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/dealers with invalid JWT → 401', async () => {
    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', 'ccm_session=invalid-token-value')
      .query({ productType: 'Motorcycle' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Validation guard
// ---------------------------------------------------------------------------

describe('Validation guard', () => {
  it('GET /api/v1/dealers without productType → 400', async () => {
    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/dealers with empty productType → 400', async () => {
    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('GET /api/v1/dealers — happy path', () => {
  it('returns 200 with structured { success: true, data: { dealers, hasActiveDealer } } shape', async () => {
    const dealerDoc = makeDealerDoc();
    mockSearchDealers.mockResolvedValue([dealerDoc] as never);
    mockCountActiveDealers.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.dealers)).toBe(true);
    expect(typeof res.body.data.hasActiveDealer).toBe('boolean');
  });

  it('returns a list of dealers when active dealers exist for productType=Motorcycle', async () => {
    const dealerDoc = makeDealerDoc();
    mockSearchDealers.mockResolvedValue([dealerDoc] as never);
    mockCountActiveDealers.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    expect(res.status).toBe(200);
    expect(res.body.data.dealers).toHaveLength(1);
    expect(res.body.data.dealers[0].dealerCode).toBe('DLR-001');
    expect(res.body.data.dealers[0].dealerName).toBe('ABC Motors');
    expect(res.body.data.hasActiveDealer).toBe(true);
  });

  it('calls searchDealers with the correct productType', async () => {
    mockSearchDealers.mockResolvedValue([]);
    mockCountActiveDealers.mockResolvedValue(0);

    await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    expect(mockSearchDealers).toHaveBeenCalledWith(
      expect.objectContaining({ productType: 'Motorcycle' }),
    );
  });
});

// ---------------------------------------------------------------------------
// productType filtering
// ---------------------------------------------------------------------------

describe('GET /api/v1/dealers?productType filtering', () => {
  it('filters by productType=Motorcycle and returns matching dealers', async () => {
    const motorcycleDealer = makeDealerDoc({ productTypes: ['Motorcycle'] });
    mockSearchDealers.mockResolvedValue([motorcycleDealer] as never);
    mockCountActiveDealers.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    expect(res.status).toBe(200);
    expect(res.body.data.dealers).toHaveLength(1);
    expect(res.body.data.dealers[0].productTypes).toContain('Motorcycle');
    expect(res.body.data.hasActiveDealer).toBe(true);
  });

  it('returns hasActiveDealer: false when productType=Unknown has no active dealers', async () => {
    mockSearchDealers.mockResolvedValue([]);
    mockCountActiveDealers.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Unknown' });

    expect(res.status).toBe(200);
    expect(res.body.data.dealers).toHaveLength(0);
    expect(res.body.data.hasActiveDealer).toBe(false);
  });

  it('passes optional search parameter to repository', async () => {
    mockSearchDealers.mockResolvedValue([]);
    mockCountActiveDealers.mockResolvedValue(0);

    await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle', search: 'ABC' });

    expect(mockSearchDealers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ABC' }),
    );
  });

  it('passes optional state/city/pinCode filters to repository', async () => {
    mockSearchDealers.mockResolvedValue([]);
    mockCountActiveDealers.mockResolvedValue(0);

    await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle', state: 'Maharashtra', city: 'Mumbai', pinCode: '400001' });

    expect(mockSearchDealers).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'Maharashtra',
        city: 'Mumbai',
        pinCode: '400001',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Response shape validation
// ---------------------------------------------------------------------------

describe('Response shape', () => {
  it('dealer objects contain all expected fields', async () => {
    const dealerDoc = makeDealerDoc();
    mockSearchDealers.mockResolvedValue([dealerDoc] as never);
    mockCountActiveDealers.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    const dealer = res.body.data.dealers[0];
    expect(dealer).toHaveProperty('id');
    expect(dealer).toHaveProperty('dealerCode');
    expect(dealer).toHaveProperty('dealerName');
    expect(dealer).toHaveProperty('branchCode');
    expect(dealer).toHaveProperty('branchName');
    expect(dealer).toHaveProperty('contactNumber');
    expect(dealer).toHaveProperty('address');
    expect(dealer).toHaveProperty('state');
    expect(dealer).toHaveProperty('city');
    expect(dealer).toHaveProperty('pinCode');
    expect(dealer).toHaveProperty('isActive');
    expect(dealer).toHaveProperty('productTypes');
  });

  it('id field is a string representation of the MongoDB ObjectId', async () => {
    const dealerDoc = makeDealerDoc();
    mockSearchDealers.mockResolvedValue([dealerDoc] as never);
    mockCountActiveDealers.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/dealers')
      .set('Cookie', authCookies())
      .query({ productType: 'Motorcycle' });

    expect(typeof res.body.data.dealers[0].id).toBe('string');
    expect(res.body.data.dealers[0].id).toBe('507f1f77bcf86cd799439050');
  });
});
