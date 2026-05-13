// =============================================================================
// CCM API — Agent Status Routes
//
// All routes require authenticate (applied in app.ts).
// Source: phase1-technical-blueprint.md §5.4–5.5
// =============================================================================

import { Router } from 'express';
import { getAgentStatusController, updateAgentStatusController } from './agent-status.controller';

export const agentStatusRouter = Router();

// GET /api/v1/agent/status
agentStatusRouter.get('/status', getAgentStatusController);

// PATCH /api/v1/agent/status
agentStatusRouter.patch('/status', updateAgentStatusController);
