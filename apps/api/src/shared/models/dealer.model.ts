// =============================================================================
// CCM API — Dealer Model (MongoDB)
//
// Stores dealer branch records. productTypes array determines which cases
// this dealer is eligible for (drives dealer filter in case creation).
// =============================================================================

import mongoose, { Schema, Document } from 'mongoose';

export interface IDealer extends Document {
  dealerCode: string;
  dealerName: string;
  branchCode: string;
  branchName: string;
  contactNumber: string;
  address: string;
  state: string;
  city: string;
  pinCode: string;
  isActive: boolean;
  productTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const dealerSchema = new Schema<IDealer>(
  {
    dealerCode:    { type: String, required: true, unique: true, trim: true },
    dealerName:    { type: String, required: true, trim: true },
    branchCode:    { type: String, required: true, unique: true, trim: true },
    branchName:    { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    address:       { type: String, required: true, trim: true },
    state:         { type: String, required: true, trim: true },
    city:          { type: String, required: true, trim: true },
    pinCode:       { type: String, required: true, trim: true },
    isActive:      { type: Boolean, default: true },
    productTypes:  [{ type: String }],
  },
  { timestamps: true, collection: 'dealers' },
);

dealerSchema.index({ productTypes: 1, isActive: 1 });
dealerSchema.index({ state: 1, city: 1 });
dealerSchema.index({ dealerName: 'text', branchName: 'text' });

export const DealerModel =
  (mongoose.models['Dealer'] as mongoose.Model<IDealer>) ||
  mongoose.model<IDealer>('Dealer', dealerSchema);
