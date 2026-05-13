// =============================================================================
// CCM API — Typed Application Error
//
// All intentional errors thrown by services, validators, and middleware
// must be instances of AppError. This ensures the error handler can
// produce consistent API error envelopes without leaking stack traces.
// =============================================================================

export type ErrorCode =
  // Auth
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'CSRF_MISSING'
  | 'CSRF_INVALID'
  | 'RATE_LIMITED'
  // Validation
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  // Resource
  | 'NOT_FOUND'
  | 'CONFLICT'
  // Business rules
  | 'INTERACTION_ALREADY_ACTIVE'
  | 'INTERACTION_ALREADY_CLOSED'
  | 'INTERACTION_NOT_ACTIVE'
  | 'INVALID_STATUS_TRANSITION'
  | 'AGENT_NOT_AVAILABLE'
  // Infrastructure
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  // Generic
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    // Capture stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // ---------------------------------------------------------------------------
  // Factory helpers — keep call sites readable
  // ---------------------------------------------------------------------------

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message = 'Access denied'): AppError {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(resource: string, id?: string): AppError {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    return new AppError('NOT_FOUND', msg, 404);
  }

  static validationError(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, 422, details);
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message, 409);
  }

  static internal(message = 'An unexpected error occurred'): AppError {
    return new AppError('INTERNAL_ERROR', message, 500, undefined, false);
  }
}
