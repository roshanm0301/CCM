// =============================================================================
// CCM API — Attachment Repository
//
// Two-layer persistence:
//   MongoDB  — stores binary content as base64 in case_attachments collection
//   PostgreSQL — stores lightweight metadata ref in case_attachment_refs table
// =============================================================================

import { Types } from 'mongoose';
import { CaseAttachmentModel, ICaseAttachment } from './attachment.model';
import { getPool } from '../../shared/database/postgres';
import type { UploadAttachmentInput } from './attachment.validator';

// ---------------------------------------------------------------------------
// MongoDB operations
// ---------------------------------------------------------------------------

/**
 * Persist a new attachment document (including base64 binary) to MongoDB.
 * sizeBytes must be computed once by the caller and passed in — this prevents
 * the repository and service from independently recomputing the value on the
 * same input, which would produce two sources of truth for an enforcement field.
 */
export async function saveAttachmentDoc(
  input: UploadAttachmentInput,
  userId: string,
  sizeBytes: number,
): Promise<ICaseAttachment> {
  const doc = await CaseAttachmentModel.create({
    caseId:           input.caseId,
    stepNo:           input.stepNo,
    originalFilename: input.filename,
    contentType:      input.contentType,
    sizeBytes,
    base64Content:    input.base64Content,
    uploadedByUserId: userId,
    createdAt:        new Date(),
  });
  return doc;
}

/** Delete an attachment document by MongoDB ObjectId string. Used for compensation on PG write failure. */
export async function deleteAttachmentDoc(mongoId: string): Promise<void> {
  if (Types.ObjectId.isValid(mongoId)) {
    await CaseAttachmentModel.findByIdAndDelete(mongoId);
  }
}

/** Retrieve a single attachment document (including base64 content) by MongoDB ObjectId. */
export async function findAttachmentDocById(id: string): Promise<ICaseAttachment | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return CaseAttachmentModel.findById(id).lean() as unknown as ICaseAttachment | null;
}

/** Retrieve metadata (no base64Content) for all attachments belonging to a case. */
export async function findAttachmentMetadataByCaseId(
  caseId: string,
): Promise<Array<{
  id: string;
  stepNo: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}>> {
  const docs = await CaseAttachmentModel
    .find({ caseId })
    .select('-base64Content')
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((doc) => ({
    id:               (doc._id as Types.ObjectId).toString(),
    stepNo:           doc.stepNo,
    originalFilename: doc.originalFilename,
    contentType:      doc.contentType,
    sizeBytes:        doc.sizeBytes,
    createdAt:        doc.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// PostgreSQL operations
// ---------------------------------------------------------------------------

/** Insert a lightweight metadata reference row into case_attachment_refs. */
export async function insertAttachmentRef(
  mongoId: string,
  input: {
    caseId: string;
    stepNo: number;
    filename: string;
    contentType: string;
    sizeBytes: number;
  },
  uploadedByUserId: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO case_attachment_refs
       (mongo_id, case_id, step_no, original_filename, content_type, size_bytes, uploaded_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      mongoId,
      input.caseId,
      input.stepNo,
      input.filename,
      input.contentType,
      input.sizeBytes,
      uploadedByUserId,
    ],
  );
}
