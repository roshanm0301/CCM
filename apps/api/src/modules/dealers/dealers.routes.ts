// =============================================================================
// CCM API — Dealers Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// =============================================================================

import { Router } from 'express';
import { searchDealersController } from './dealers.controller';

export const dealersRouter = Router();

// GET /api/v1/dealers?productType=X&search=X&state=X&city=X&pinCode=X
dealersRouter.get('/', searchDealersController);
