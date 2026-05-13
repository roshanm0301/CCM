// =============================================================================
// CCM API — ReferenceMaster MongoDB Model
//
// Generic lookup/reference master stored in MongoDB.
// Used for: Department, Case Nature, Priority (and future masters).
//
// Collection: referencemasters
// =============================================================================

import mongoose, { Schema, Document } from 'mongoose';

export interface IReferenceMaster extends Document {
  masterType: string;   // e.g. 'department', 'case_nature', 'priority'
  code: string;         // stable machine code, uppercase e.g. 'SALES'
  label: string;        // human-readable display label
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const referenceMasterSchema = new Schema<IReferenceMaster>(
  {
    masterType: { type: String, required: true, trim: true },
    code:       { type: String, required: true, trim: true },
    label:      { type: String, required: true, trim: true },
    sortOrder:  { type: Number, default: 0 },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'referencemasters' },
);

// Unique per type+code combination
referenceMasterSchema.index({ masterType: 1, code: 1 }, { unique: true });
referenceMasterSchema.index({ masterType: 1, isActive: 1, sortOrder: 1 });

export const ReferenceMasterModel =
  (mongoose.models['ReferenceMaster'] as mongoose.Model<IReferenceMaster>) ||
  mongoose.model<IReferenceMaster>('ReferenceMaster', referenceMasterSchema);
