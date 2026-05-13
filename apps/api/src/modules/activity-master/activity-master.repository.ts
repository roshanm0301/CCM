// =============================================================================
// CCM API — Activity Master Repository (MongoDB / Mongoose)
//
// All Mongoose operations for the Activity Master.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import mongoose, { Schema, Document, Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Mongoose document interface
// ---------------------------------------------------------------------------

export interface IActivityMaster extends Document {
  code: string;
  displayName: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;  // Fix 8: track last-modifier
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const activityMasterSchema = new Schema<IActivityMaster>(
  {
    code:        { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: String, default: null },
    updatedBy:   { type: String, default: null },
  },
  { timestamps: true, collection: 'activitymasters' },
);

activityMasterSchema.index({ isActive: 1 });

// ---------------------------------------------------------------------------
// Model — guard against OverwriteModelError in tests
// ---------------------------------------------------------------------------

const ActivityMasterModel =
  (mongoose.models['ActivityMaster'] as mongoose.Model<IActivityMaster>) ||
  mongoose.model<IActivityMaster>('ActivityMaster', activityMasterSchema);

// ---------------------------------------------------------------------------
// Row type — camelCase, consumed by service layer
// ---------------------------------------------------------------------------

export interface ActivityMasterRow {
  id: string;
  code: string;
  displayName: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function docToRow(doc: IActivityMaster): ActivityMasterRow {
  return {
    id:          (doc._id as Types.ObjectId).toString(),
    code:        doc.code,
    displayName: doc.displayName,
    description: doc.description,
    isActive:    doc.isActive,
    createdBy:   doc.createdBy,
    updatedBy:   doc.updatedBy ?? null,
    createdAt:   doc.createdAt,
    updatedAt:   doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** All activities sorted by displayName. */
export async function findAllActivities(): Promise<ActivityMasterRow[]> {
  const docs = await ActivityMasterModel.find().sort({ displayName: 1 }).lean();
  return docs.map((d) => docToRow(d as unknown as IActivityMaster));
}

/** Active activities only — used for template step dropdowns. */
export async function findActiveActivities(): Promise<ActivityMasterRow[]> {
  const docs = await ActivityMasterModel.find({ isActive: true }).sort({ displayName: 1 }).lean();
  return docs.map((d) => docToRow(d as unknown as IActivityMaster));
}

/** Find by ID. */
export async function findActivityById(id: string): Promise<ActivityMasterRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ActivityMasterModel.findById(id).lean();
  if (!doc) return null;
  return docToRow(doc as unknown as IActivityMaster);
}

/**
 * Find by code (case-insensitive, trimmed).
 * Optionally excludes a given ID for update uniqueness checks.
 */
export async function findActivityByCode(
  code: string,
  excludeId?: string,
): Promise<ActivityMasterRow | null> {
  const filter: Record<string, unknown> = {
    code: { $regex: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter['_id'] = { $ne: new Types.ObjectId(excludeId) };
  }
  const doc = await ActivityMasterModel.findOne(filter).lean();
  if (!doc) return null;
  return docToRow(doc as unknown as IActivityMaster);
}

/** Create a new activity. */
export async function createActivity(
  data: { code: string; displayName: string; description: string; isActive?: boolean },
  userId: string,
): Promise<ActivityMasterRow> {
  const doc = await ActivityMasterModel.create({
    code:        data.code,
    displayName: data.displayName,
    description: data.description,
    isActive:    data.isActive ?? true,
    createdBy:   userId,
    updatedBy:   userId,
  });
  return docToRow(doc);
}

/** Update an existing activity — records the acting user for audit. */
export async function updateActivity(
  id: string,
  data: Partial<{ code: string; displayName: string; description: string; isActive: boolean }>,
  userId: string,   // Fix 8: now required
): Promise<ActivityMasterRow> {
  const update: Record<string, unknown> = { updatedBy: userId };
  if (data.code        !== undefined) update['code']        = data.code;
  if (data.displayName !== undefined) update['displayName'] = data.displayName;
  if (data.description !== undefined) update['description'] = data.description;
  if (data.isActive    !== undefined) update['isActive']    = data.isActive;

  const doc = await ActivityMasterModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  if (!doc) throw new Error(`ActivityMaster ${id} not found after update`);
  return docToRow(doc as unknown as IActivityMaster);
}
