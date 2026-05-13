// =============================================================================
// CCM API — Counter Model (MongoDB)
//
// Provides atomic sequential ID generation.
// Usage: findOneAndUpdate with $inc for race-condition-safe increment.
// =============================================================================

import mongoose, { Schema } from 'mongoose';

// Counter documents use a string _id (the counter name, e.g. 'case_id').
// We avoid extending Document directly because Mongoose's Document type
// fixes _id to ObjectId, which conflicts with our string _id convention.
export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters', _id: false, versionKey: false },
);

export const CounterModel =
  (mongoose.models['Counter'] as mongoose.Model<ICounter>) ||
  mongoose.model<ICounter>('Counter', counterSchema);

/**
 * Atomically increments the named counter and returns the new sequence value.
 * Safe under concurrent writes.
 */
export async function nextSequence(counterId: string): Promise<number> {
  const result = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return result!.seq;
}
