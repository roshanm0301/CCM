// =============================================================================
// CCM API — Attachment Routes
//
// All routes require authenticate (applied in app.ts when mounting).
// IMPORTANT: GET / is registered before GET /:id to avoid route conflicts.
// =============================================================================

import { Router } from 'express';
import {
  uploadAttachmentController,
  getAttachmentController,
  getAttachmentsByCaseController,
} from './attachment.controller';

export const attachmentRouter = Router();

// IMPORTANT: GET / must be registered before GET /:id
attachmentRouter.get('/', getAttachmentsByCaseController);
attachmentRouter.get('/:id', getAttachmentController);
attachmentRouter.post('/', uploadAttachmentController);
