// =============================================================================
// CCM API — Case Attachment Model (MongoDB)
//
// Stores file attachments uploaded during resolution activities.
// Binary content is persisted as a base64 string.
// =============================================================================

import mongoose, { Schema, Document } from 'mongoose';

export type AttachmentContentType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/png';

export interface ICaseAttachment extends Document {
  caseId: string;
  stepNo: number;
  originalFilename: string;
  contentType: AttachmentContentType;
  sizeBytes: number;
  base64Content: string;
  uploadedByUserId: string;
  createdAt: Date;
}

const caseAttachmentSchema = new Schema<ICaseAttachment>(
  {
    caseId:           { type: String, required: true, index: true },
    stepNo:           { type: Number, required: true },
    originalFilename: { type: String, required: true },
    contentType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    },
    sizeBytes:        { type: Number, required: true },
    base64Content:    { type: String, required: true },
    uploadedByUserId: { type: String, required: true },
    createdAt:        { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'case_attachments' },
);

export const CaseAttachmentModel =
  (mongoose.models['CaseAttachment'] as mongoose.Model<ICaseAttachment>) ||
  mongoose.model<ICaseAttachment>('CaseAttachment', caseAttachmentSchema);
