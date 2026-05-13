// =============================================================================
// CCM API — Activity Template Repository (MongoDB / Mongoose)
//
// Stores templates with embedded steps and outcomes.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–5
// =============================================================================

import mongoose, { Schema, Document, Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Mongoose interfaces
// ---------------------------------------------------------------------------

export interface IOutcome {
  outcomeName: string;
  outcomeType: 'MoveForward' | 'Loop' | 'Close';
  nextStepNo: number | null;
  roleOverride: string | null;
  requiresOtpVerification: boolean;
}

export interface ITemplateStep {
  stepNo: number;
  activityId: string;
  assignedRole: string;
  slaValue: number | null;
  slaUnit: 'Hours' | 'Days' | null;
  weightPercentage: number;
  isMandatory: boolean;
  isStartStep: boolean;
  outcomes: IOutcome[];
}

export interface IActivityTemplate extends Document {
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive: boolean;
  steps: ITemplateStep[];
  createdBy: string | null;
  updatedBy: string | null;   // Fix 8: track last-modifier
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const outcomeSubSchema = new Schema<IOutcome>(
  {
    outcomeName:             { type: String, required: true, trim: true },
    outcomeType:             { type: String, required: true, enum: ['MoveForward', 'Loop', 'Close'] },
    nextStepNo:              { type: Number, default: null },
    roleOverride:            { type: String, default: null },
    requiresOtpVerification: { type: Boolean, default: false },
  },
  { _id: false },
);

const stepSubSchema = new Schema<ITemplateStep>(
  {
    stepNo:           { type: Number, required: true },
    activityId:       { type: String, required: true },
    assignedRole:     { type: String, required: true },
    slaValue:         { type: Number, default: null },
    slaUnit:          { type: String, enum: ['Hours', 'Days', null], default: null },
    weightPercentage: { type: Number, default: 0 },
    isMandatory:      { type: Boolean, default: false },
    isStartStep:      { type: Boolean, default: false },
    outcomes:         { type: [outcomeSubSchema], default: [] },
  },
  { _id: false },
);

const activityTemplateSchema = new Schema<IActivityTemplate>(
  {
    templateName: { type: String, required: true, trim: true },
    appliesTo:    { type: String, required: true, trim: true },
    department:   { type: String, required: true, trim: true },
    productType:  { type: String, required: true, trim: true },
    isActive:     { type: Boolean, default: true },
    steps:        { type: [stepSubSchema], default: [] },
    createdBy:    { type: String, default: null },
    updatedBy:    { type: String, default: null },
  },
  { timestamps: true, collection: 'activitytemplates' },
);

activityTemplateSchema.index({ isActive: 1 });
activityTemplateSchema.index({ appliesTo: 1, department: 1, productType: 1, isActive: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

const ActivityTemplateModel =
  (mongoose.models['ActivityTemplate'] as mongoose.Model<IActivityTemplate>) ||
  mongoose.model<IActivityTemplate>('ActivityTemplate', activityTemplateSchema);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface OutcomeRow {
  outcomeName: string;
  outcomeType: 'MoveForward' | 'Loop' | 'Close';
  nextStepNo: number | null;
  roleOverride: string | null;
  requiresOtpVerification: boolean;
}

export interface TemplateStepRow {
  stepNo: number;
  activityId: string;
  assignedRole: string;
  slaValue: number | null;
  slaUnit: 'Hours' | 'Days' | null;
  weightPercentage: number;
  isMandatory: boolean;
  isStartStep: boolean;
  outcomes: OutcomeRow[];
}

export interface ActivityTemplateSummaryRow {
  id: string;
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityTemplateFullRow extends ActivityTemplateSummaryRow {
  steps: TemplateStepRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docToOutcomeRow(o: IOutcome): OutcomeRow {
  return {
    outcomeName:             o.outcomeName,
    outcomeType:             o.outcomeType,
    nextStepNo:              o.nextStepNo ?? null,
    roleOverride:            o.roleOverride ?? null,
    requiresOtpVerification: o.requiresOtpVerification,
  };
}

function docToStepRow(s: ITemplateStep): TemplateStepRow {
  return {
    stepNo:           s.stepNo,
    activityId:       s.activityId,
    assignedRole:     s.assignedRole,
    slaValue:         s.slaValue ?? null,
    slaUnit:          s.slaUnit ?? null,
    weightPercentage: s.weightPercentage,
    isMandatory:      s.isMandatory,
    isStartStep:      s.isStartStep,
    outcomes:         (s.outcomes ?? []).map(docToOutcomeRow),
  };
}

function docToSummaryRow(doc: IActivityTemplate): ActivityTemplateSummaryRow {
  return {
    id:           (doc._id as Types.ObjectId).toString(),
    templateName: doc.templateName,
    appliesTo:    doc.appliesTo,
    department:   doc.department,
    productType:  doc.productType,
    isActive:     doc.isActive,
    createdBy:    doc.createdBy,
    updatedBy:    doc.updatedBy ?? null,
    createdAt:    doc.createdAt,
    updatedAt:    doc.updatedAt,
  };
}

function docToFullRow(doc: IActivityTemplate): ActivityTemplateFullRow {
  return {
    ...docToSummaryRow(doc),
    steps: (doc.steps ?? []).map(docToStepRow),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** All templates — header fields only, sorted by templateName. */
export async function findAllTemplates(): Promise<ActivityTemplateSummaryRow[]> {
  const docs = await ActivityTemplateModel.find(
    {},
    { steps: 0 },
  ).sort({ templateName: 1 }).lean();
  return docs.map((d) => docToSummaryRow(d as unknown as IActivityTemplate));
}

/** Single template with full steps and outcomes. */
export async function findTemplateById(id: string): Promise<ActivityTemplateFullRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ActivityTemplateModel.findById(id).lean();
  if (!doc) return null;
  return docToFullRow(doc as unknown as IActivityTemplate);
}

/**
 * Find an existing *active* template for the same applicability triple,
 * optionally excluding a given ID (for update checks).
 */
export async function findActiveTemplateConflict(
  appliesTo: string,
  department: string,
  productType: string,
  excludeId?: string,
): Promise<ActivityTemplateSummaryRow | null> {
  const filter: Record<string, unknown> = {
    appliesTo,
    department,
    productType,
    isActive: true,
  };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter['_id'] = { $ne: new Types.ObjectId(excludeId) };
  }
  const doc = await ActivityTemplateModel.findOne(filter, { steps: 0 }).lean();
  if (!doc) return null;
  return docToSummaryRow(doc as unknown as IActivityTemplate);
}

/** Create a new template. */
export async function createTemplate(
  data: {
    templateName: string;
    appliesTo: string;
    department: string;
    productType: string;
    isActive: boolean;
    steps: TemplateStepRow[];
  },
  userId: string,
): Promise<ActivityTemplateFullRow> {
  const doc = await ActivityTemplateModel.create({
    templateName: data.templateName,
    appliesTo:    data.appliesTo,
    department:   data.department,
    productType:  data.productType,
    isActive:     data.isActive,
    steps:        data.steps,
    createdBy:    userId,
    updatedBy:    userId,
  });
  return docToFullRow(doc);
}

/** Replace a template (full document update) — records the acting user. */
export async function updateTemplate(
  id: string,
  data: {
    templateName: string;
    appliesTo: string;
    department: string;
    productType: string;
    isActive: boolean;
    steps: TemplateStepRow[];
  },
  userId: string,   // Fix 8: required for audit trail
): Promise<ActivityTemplateFullRow> {
  const doc = await ActivityTemplateModel.findByIdAndUpdate(
    id,
    {
      $set: {
        templateName: data.templateName,
        appliesTo:    data.appliesTo,
        department:   data.department,
        productType:  data.productType,
        isActive:     data.isActive,
        steps:        data.steps,
        updatedBy:    userId,
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!doc) throw new Error(`ActivityTemplate ${id} not found after update`);
  return docToFullRow(doc as unknown as IActivityTemplate);
}
