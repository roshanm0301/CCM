// =============================================================================
// CCM API — Master Data Routes
//
// All routes require authenticate (applied in app.ts).
// Source: phase1-technical-blueprint.md §5.16
// =============================================================================

import { Router } from 'express';
import { getMasterDataController } from './master-data.controller';

export const masterDataRouter = Router();

// GET /api/v1/master-data/:type
masterDataRouter.get('/:type', getMasterDataController);
