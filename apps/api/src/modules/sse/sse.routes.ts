import { Router } from 'express';
import { sseEventsController } from './sse.controller';

export const sseRouter = Router();

// GET — no CSRF required (read-only, no state mutation)
sseRouter.get('/events', sseEventsController);
