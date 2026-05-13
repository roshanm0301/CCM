// =============================================================================
// CCM API — Attachment Service
//
// Business logic for uploading and retrieving case attachments.
// Enforces 5 MB binary size limit, coordinates MongoDB + PostgreSQL writes.
// =============================================================================

import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import {
  saveAttachmentDoc,
  deleteAttachmentDoc,
  findAttachmentDocById,
  findAttachmentMetadataByCaseId,
  insertAttachmentRef,
} from './attachment.repository';
import type { UploadAttachmentInput } from './attachment.validator';

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface AttachmentDto {
  id: string;
  caseId: string;
  stepNo: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  base64Content?: string; // only included in getAttachmentService response
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Upload a file attachment for a resolution activity step.
 * Validates that the decoded binary is within the 5 MB limit,
 * saves the document to MongoDB, then mirrors metadata to PostgreSQL.
 * Returns a DTO without base64Content.
 */
export async function uploadAttachmentService(
  input: UploadAttachmentInput,
  userId: string,
  correlationId: string,
): Promise<AttachmentDto> {
  // Compute sizeBytes once — this is the single authoritative value used for both
  // the enforcement check and both persistence layers (MongoDB + PostgreSQL).
  const sizeBytes = Math.ceil(input.base64Content.length * 0.75);

  if (sizeBytes > 5_242_880) {
    throw AppError.validationError(
      'File exceeds the maximum allowed size of 5 MB',
      { sizeBytes, maxBytes: 5_242_880 },
    );
  }

  // Step 1 — persist to MongoDB (pass sizeBytes so the repo does not recompute it).
  const doc = await saveAttachmentDoc(input, userId, sizeBytes);
  const mongoId = (doc._id as Types.ObjectId).toString();

  // Step 2 — mirror metadata to PostgreSQL.
  // If the PG write fails, compensate by deleting the orphaned MongoDB document
  // so the two stores remain consistent and no ghost attachments accumulate.
  try {
    await insertAttachmentRef(
      mongoId,
      {
        caseId:      input.caseId,
        stepNo:      input.stepNo,
        filename:    input.filename,
        contentType: input.contentType,
        sizeBytes,
      },
      userId,
    );
  } catch (pgErr) {
    try {
      await deleteAttachmentDoc(mongoId);
    } catch (compensationErr) {
      logger.error('CRITICAL: MongoDB compensation delete failed — attachment orphaned', {
        module: 'attachment.service',
        mongoId,
        correlationId,
        compensationError: compensationErr instanceof Error
          ? compensationErr.message
          : String(compensationErr),
      });
    }
    throw pgErr;
  }

  return {
    id:               mongoId,
    caseId:           doc.caseId,
    stepNo:           doc.stepNo,
    originalFilename: doc.originalFilename,
    contentType:      doc.contentType,
    sizeBytes:        doc.sizeBytes,
    createdAt:        doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date(doc.createdAt).toISOString(),
  };
}

/**
 * Retrieve a single attachment by its MongoDB ObjectId.
 * Returns the DTO WITH base64Content for client-side download.
 * Throws 404 if not found.
 */
export async function getAttachmentService(id: string): Promise<AttachmentDto> {
  const doc = await findAttachmentDocById(id);
  if (!doc) {
    throw AppError.notFound('Attachment', id);
  }

  return {
    id:               (doc._id as Types.ObjectId).toString(),
    caseId:           doc.caseId,
    stepNo:           doc.stepNo,
    originalFilename: doc.originalFilename,
    contentType:      doc.contentType,
    sizeBytes:        doc.sizeBytes,
    createdAt:        doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date(doc.createdAt).toISOString(),
    base64Content:    doc.base64Content,
  };
}

/**
 * Retrieve attachment metadata list for a case (no base64Content).
 */
export async function getAttachmentMetadataService(caseId: string): Promise<AttachmentDto[]> {
  const items = await findAttachmentMetadataByCaseId(caseId);

  return items.map((item) => ({
    id:               item.id,
    caseId,
    stepNo:           item.stepNo,
    originalFilename: item.originalFilename,
    contentType:      item.contentType,
    sizeBytes:        item.sizeBytes,
    createdAt:        item.createdAt instanceof Date
      ? item.createdAt.toISOString()
      : new Date(item.createdAt).toISOString(),
  }));
}
