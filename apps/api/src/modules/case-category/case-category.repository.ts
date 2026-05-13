// =============================================================================
// CCM API — Case Category Repository (MongoDB / Mongoose)
//
// All Mongoose operations for case categories and subcategories.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { ReferenceMasterModel } from '../../shared/models/referenceMaster.model';

// ---------------------------------------------------------------------------
// Mongoose sub-document and document interfaces
// ---------------------------------------------------------------------------

export interface ICaseSubcategory extends Document {
  categoryId: Types.ObjectId | string;
  code: string;
  displayName: string;
  definition: string;
  isActive: boolean;
  inactivatedByCascade: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICaseCategory extends Document {
  code: string;
  displayName: string;
  definition: string;
  departments: string[];
  caseNatures: string[];
  productTypes: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const caseCategorySchema = new Schema<ICaseCategory>(
  {
    code:         { type: String, required: true, unique: true, trim: true },
    displayName:  { type: String, required: true, unique: true, trim: true },
    definition:   { type: String, required: true, trim: true },
    departments:  [{ type: String }],
    caseNatures:  [{ type: String }],
    productTypes: [{ type: String }],
    isActive:     { type: Boolean, default: true },
    createdBy:    { type: String, default: null },
  },
  { timestamps: true, collection: 'casecategories' },
);

caseCategorySchema.index({ isActive: 1 });

const caseSubcategorySchema = new Schema<ICaseSubcategory>(
  {
    categoryId:           { type: Schema.Types.ObjectId, ref: 'CaseCategory', required: true },
    code:                 { type: String, required: true, unique: true, trim: true },
    displayName:          { type: String, required: true, trim: true },
    definition:           { type: String, required: true, trim: true },
    isActive:             { type: Boolean, default: true },
    inactivatedByCascade: { type: Boolean, default: false },
    createdBy:            { type: String, default: null },
  },
  { timestamps: true, collection: 'casesubcategories' },
);

caseSubcategorySchema.index({ categoryId: 1 });
caseSubcategorySchema.index({ isActive: 1 });

// ---------------------------------------------------------------------------
// Models — use mongoose.models check to avoid OverwriteModelError in tests
// ---------------------------------------------------------------------------

const CaseCategoryModel =
  (mongoose.models['CaseCategory'] as mongoose.Model<ICaseCategory>) ||
  mongoose.model<ICaseCategory>('CaseCategory', caseCategorySchema);

const CaseSubcategoryModel =
  (mongoose.models['CaseSubcategory'] as mongoose.Model<ICaseSubcategory>) ||
  mongoose.model<ICaseSubcategory>('CaseSubcategory', caseSubcategorySchema);

// ---------------------------------------------------------------------------
// Row types (camelCase — matches Mongoose document fields)
// Service layer consumes these shapes.
// ---------------------------------------------------------------------------

export interface CategoryRow {
  id: string;
  code: string;
  displayName: string;
  definition: string;
  departments: string[];
  caseNatures: string[];
  productTypes: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  subcategoryCount?: number;
}

export interface SubcategoryRow {
  id: string;
  categoryId: string;
  code: string;
  displayName: string;
  definition: string;
  isActive: boolean;
  inactivatedByCascade: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docToCategoryRow(doc: ICaseCategory, subcategoryCount?: number): CategoryRow {
  return {
    id:               (doc._id as Types.ObjectId).toString(),
    code:             doc.code,
    displayName:      doc.displayName,
    definition:       doc.definition,
    departments:      doc.departments,
    caseNatures:      doc.caseNatures,
    productTypes:     doc.productTypes,
    isActive:         doc.isActive,
    createdBy:        doc.createdBy,
    createdAt:        doc.createdAt,
    updatedAt:        doc.updatedAt,
    subcategoryCount,
  };
}

function docToSubcategoryRow(doc: ICaseSubcategory): SubcategoryRow {
  return {
    id:                   (doc._id as Types.ObjectId).toString(),
    categoryId:           doc.categoryId.toString(),
    code:                 doc.code,
    displayName:          doc.displayName,
    definition:           doc.definition,
    isActive:             doc.isActive,
    inactivatedByCascade: doc.inactivatedByCascade,
    createdBy:            doc.createdBy,
    createdAt:            doc.createdAt,
    updatedAt:            doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Category queries
// ---------------------------------------------------------------------------

/** Find all categories with subcategory count. */
export async function findAllCategories(): Promise<CategoryRow[]> {
  const categories = await CaseCategoryModel.find().sort({ displayName: 1 }).lean();
  const ids = categories.map((c) => c._id);
  // Aggregate subcategory counts in one query
  const counts = await CaseSubcategoryModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { categoryId: { $in: ids } } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return categories.map((c) =>
    docToCategoryRow(c as unknown as ICaseCategory, countMap.get((c._id as Types.ObjectId).toString()) ?? 0),
  );
}

/** Find a single category by ID. */
export async function findCategoryById(id: string): Promise<CategoryRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await CaseCategoryModel.findById(id).lean();
  if (!doc) return null;
  return docToCategoryRow(doc as unknown as ICaseCategory);
}

/** Find a category by code (for uniqueness check). */
export async function findCategoryByCode(code: string): Promise<CategoryRow | null> {
  const doc = await CaseCategoryModel.findOne({ code }).lean();
  if (!doc) return null;
  return docToCategoryRow(doc as unknown as ICaseCategory);
}

/** Find a category by display name (case-insensitive), optionally excluding a given ID. */
export async function findCategoryByDisplayName(
  name: string,
  excludeId?: string,
): Promise<CategoryRow | null> {
  const filter: Record<string, unknown> = {
    displayName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter['_id'] = { $ne: new Types.ObjectId(excludeId) };
  }
  const doc = await CaseCategoryModel.findOne(filter).lean();
  if (!doc) return null;
  return docToCategoryRow(doc as unknown as ICaseCategory);
}

/** Create a new case category. */
export async function createCategory(
  data: { code: string; displayName: string; definition: string; departments: string[]; caseNatures: string[]; productTypes: string[]; isActive?: boolean },
  userId: string,
): Promise<CategoryRow> {
  const doc = await CaseCategoryModel.create({
    code:         data.code,
    displayName:  data.displayName,
    definition:   data.definition,
    departments:  data.departments,
    caseNatures:  data.caseNatures,
    productTypes: data.productTypes,
    isActive:     data.isActive ?? true,
    createdBy:    userId,
  });
  return docToCategoryRow(doc);
}

/** Update an existing case category. */
export async function updateCategory(
  id: string,
  data: Partial<{ code: string; displayName: string; definition: string; departments: string[]; caseNatures: string[]; productTypes: string[]; isActive: boolean }>,
  session?: ClientSession,
): Promise<CategoryRow> {
  const update: Record<string, unknown> = {};
  if (data.code         !== undefined) update['code']         = data.code;
  if (data.displayName  !== undefined) update['displayName']  = data.displayName;
  if (data.definition   !== undefined) update['definition']   = data.definition;
  if (data.departments  !== undefined) update['departments']  = data.departments;
  if (data.caseNatures  !== undefined) update['caseNatures']  = data.caseNatures;
  if (data.productTypes !== undefined) update['productTypes'] = data.productTypes;
  if (data.isActive     !== undefined) update['isActive']     = data.isActive;

  const doc = await CaseCategoryModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true, session },
  ).lean();
  if (!doc) throw new Error(`CaseCategory ${id} not found after update`);
  return docToCategoryRow(doc as unknown as ICaseCategory);
}

// ---------------------------------------------------------------------------
// Subcategory queries
// ---------------------------------------------------------------------------

/** Get all subcategories for a category, sorted by displayName. */
export async function findSubcategoriesByCategoryId(categoryId: string): Promise<SubcategoryRow[]> {
  if (!Types.ObjectId.isValid(categoryId)) return [];
  const docs = await CaseSubcategoryModel.find({ categoryId: new Types.ObjectId(categoryId) })
    .sort({ displayName: 1 })
    .lean();
  return docs.map((d) => docToSubcategoryRow(d as unknown as ICaseSubcategory));
}

/** Find a single subcategory by its ID. */
export async function findSubcategoryById(id: string): Promise<SubcategoryRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await CaseSubcategoryModel.findById(id).lean();
  if (!doc) return null;
  return docToSubcategoryRow(doc as unknown as ICaseSubcategory);
}

/** Find a subcategory by global code uniqueness, optionally excluding a given ID. */
export async function findSubcategoryByCode(
  code: string,
  excludeId?: string,
): Promise<SubcategoryRow | null> {
  const filter: Record<string, unknown> = { code };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter['_id'] = { $ne: new Types.ObjectId(excludeId) };
  }
  const doc = await CaseSubcategoryModel.findOne(filter).lean();
  if (!doc) return null;
  return docToSubcategoryRow(doc as unknown as ICaseSubcategory);
}

/** Find subcategory by display name within its parent category, optionally excluding a given ID. */
export async function findSubcategoryByDisplayNameInCategory(
  displayName: string,
  categoryId: string,
  excludeId?: string,
): Promise<SubcategoryRow | null> {
  const filter: Record<string, unknown> = {
    categoryId: new Types.ObjectId(categoryId),
    displayName: { $regex: new RegExp(`^${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter['_id'] = { $ne: new Types.ObjectId(excludeId) };
  }
  const doc = await CaseSubcategoryModel.findOne(filter).lean();
  if (!doc) return null;
  return docToSubcategoryRow(doc as unknown as ICaseSubcategory);
}

/** Create a new subcategory. */
export async function createSubcategory(
  categoryId: string,
  data: { code: string; displayName: string; definition: string; isActive?: boolean },
  userId: string,
): Promise<SubcategoryRow> {
  const doc = await CaseSubcategoryModel.create({
    categoryId:           new Types.ObjectId(categoryId),
    code:                 data.code,
    displayName:          data.displayName,
    definition:           data.definition,
    isActive:             data.isActive ?? true,
    inactivatedByCascade: false,
    createdBy:            userId,
  });
  return docToSubcategoryRow(doc);
}

/** Update an existing subcategory. */
export async function updateSubcategory(
  id: string,
  data: Partial<{ code: string; displayName: string; definition: string; isActive: boolean }>,
): Promise<SubcategoryRow> {
  const update: Record<string, unknown> = {};
  if (data.code        !== undefined) update['code']        = data.code;
  if (data.displayName !== undefined) update['displayName'] = data.displayName;
  if (data.definition  !== undefined) update['definition']  = data.definition;
  if (data.isActive    !== undefined) {
    update['isActive'] = data.isActive;
    // If explicitly reactivating, clear the cascade flag
    if (data.isActive) update['inactivatedByCascade'] = false;
  }

  const doc = await CaseSubcategoryModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  if (!doc) throw new Error(`CaseSubcategory ${id} not found after update`);
  return docToSubcategoryRow(doc as unknown as ICaseSubcategory);
}

/** Cascade-inactivate all active subcategories for a category. */
export async function cascadeInactivateSubcategories(categoryId: string, session?: ClientSession): Promise<void> {
  await CaseSubcategoryModel.updateMany(
    { categoryId: new Types.ObjectId(categoryId), isActive: true },
    { $set: { isActive: false, inactivatedByCascade: true } },
    { session },
  );
}

/** Reactivate subcategories that were cascade-inactivated for a category. */
export async function cascadeReactivateSubcategories(categoryId: string, session?: ClientSession): Promise<void> {
  await CaseSubcategoryModel.updateMany(
    { categoryId: new Types.ObjectId(categoryId), inactivatedByCascade: true },
    { $set: { isActive: true, inactivatedByCascade: false } },
    { session },
  );
}

// ---------------------------------------------------------------------------
// Lookup queries — reference_values remains in PostgreSQL (shared master data)
// ---------------------------------------------------------------------------

export interface ReferenceValueRow {
  code: string;
  label: string;
}

/** Fetch active reference masters by type, ordered by sortOrder. */
export async function findReferenceValuesByType(referenceType: string): Promise<ReferenceValueRow[]> {
  const docs = await ReferenceMasterModel.find(
    { masterType: referenceType, isActive: true },
    { code: 1, label: 1, _id: 0 },
  ).sort({ sortOrder: 1 }).lean();
  return docs.map((d) => ({ code: d.code as string, label: d.label as string }));
}
