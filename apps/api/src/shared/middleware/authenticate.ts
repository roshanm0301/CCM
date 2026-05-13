// =============================================================================
// CCM API — JWT Authentication Middleware
//
// Reads the session JWT from the httpOnly cookie 'ccm_session'.
// Attaches the decoded actor context to req.user for downstream use.
// Does NOT fall back to Authorization header — cookie-only by design.
//
// Source: security-principles.md § JWT / Cookie strategy
//         phase1-technical-blueprint.md § 5.3 Auth Flow
// =============================================================================

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index';
import { AppError } from '../errors/AppError';

export interface ActorContext {
  userId: string;
  username: string;
  roles: string[];
}

// Extend Express Request to carry the actor context
declare global {
  namespace Express {
    interface Request {
      user?: ActorContext;
      correlationId?: string;
    }
  }
}

const SESSION_COOKIE = 'ccm_session';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;

  if (!token) {
    return next(AppError.unauthorized('No session cookie present'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as ActorContext & {
      iat?: number;
      exp?: number;
    };

    if (
      typeof decoded.userId !== 'string' || decoded.userId.length === 0 ||
      typeof decoded.username !== 'string' ||
      !Array.isArray(decoded.roles) ||
      !decoded.roles.every((r) => typeof r === 'string')
    ) {
      return next(AppError.unauthorized('Invalid token: required claims malformed'));
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      roles: decoded.roles,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('TOKEN_EXPIRED', 'Session has expired', 401));
    }
    return next(AppError.unauthorized('Invalid session token'));
  }
}
