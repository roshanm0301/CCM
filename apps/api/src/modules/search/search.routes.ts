// =============================================================================
// CCM API — Search Routes
//
// All routes require authenticate (applied in app.ts).
// Source: phase1-technical-blueprint.md §5.12
// =============================================================================

import { Router } from 'express';
import { searchController } from './search.controller';

export const searchRouter = Router();

// POST /api/v1/search
searchRouter.post('/', searchController);
