// =============================================================================
// CCM API — Case Model (MongoDB)
//
// Stores registered service cases created during interactions.
// caseId is the human-readable ISR-001, ISR-002 sequence.
// =============================================================================

import mongoose, { Schema, Document, Types } from 'mongoose';

export type CaseStatus =
  | 'Open'
  | 'Pending Verification'
  | 'Closed \u2013 Verified'
  | 'Closed \u2013 Not Verified';

export type ActivityStatus = 'Fresh' | 'In Progress' | 'Resolved';

export type ProductTypeSource = 'Derived' | 'Manually Selected';

export interface ICase extends Document {
  caseId: string;               // ISR-001, ISR-002 ...
  interactionId: string;
  customerRef: string;
  vehicleRef: string | null;
  dealerRef: string;
  caseNature: string;
  department: string;
  priority: string | null;
  productType: string;
  productTypeSource: ProductTypeSource;
  caseCategoryId: Types.ObjectId | string;
  caseSubcategoryId: Types.ObjectId | string;
  customerRemarks: string;
  agentRemarks: string;
  caseStatus: CaseStatus;
  activityStatus: ActivityStatus;
  createdBy: string;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<ICase>(
  {
    caseId:            { type: String, required: true, unique: true },
    interactionId:     { type: String, required: true, unique: true },  // 1 case per interaction
    customerRef:       { type: String, required: true },
    vehicleRef:        { type: String, default: null },
    dealerRef:         { type: String, required: true },
    caseNature:        { type: String, required: true },
    department:        { type: String, required: true },
    priority:          { type: String, default: null },
    productType:       { type: String, required: true },
    productTypeSource: { type: String, enum: ['Derived', 'Manually Selected'], required: true },
    caseCategoryId:    { type: Schema.Types.ObjectId, ref: 'CaseCategory', required: true },
    caseSubcategoryId: { type: Schema.Types.ObjectId, ref: 'CaseSubcategory', required: true },
    customerRemarks:   { type: String, required: true, maxlength: 1000 },
    agentRemarks:      { type: String, required: true, maxlength: 1000 },
    caseStatus: {
      type: String,
      enum: ['Open', 'Pending Verification', 'Closed \u2013 Verified', 'Closed \u2013 Not Verified'],
      default: 'Open',
    },
    activityStatus: {
      type: String,
      enum: ['Fresh', 'In Progress', 'Resolved'],
      default: 'Fresh',
    },
    createdBy:    { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'cases' },
);

caseSchema.index({ customerRef: 1, caseStatus: 1 });
caseSchema.index({
  customerRef: 1,
  vehicleRef: 1,
  caseNature: 1,
  department: 1,
  caseCategoryId: 1,
  caseSubcategoryId: 1,
  caseStatus: 1,
});

export const CaseModel =
  (mongoose.models['Case'] as mongoose.Model<ICase>) ||
  mongoose.model<ICase>('Case', caseSchema);
