// =============================================================================
// Seed script — Reference Masters (Department, Case Nature, Priority)
//
// When to run: once per fresh MongoDB volume, or whenever reference data needs
// to be reset. Reference masters drive the dropdowns in case registration and
// resolution activity forms. Without this data those dropdowns will be empty.
//
// Run via (from apps/api/):
//   npm run seed:references
//   — or —
//   npx tsx src/scripts/seedReferenceMasters.ts
//
// Idempotent: uses upsert so it is safe to re-run.
// =============================================================================

import { connectMongo, closeMongo } from '../shared/database/mongo';
import { ReferenceMasterModel } from '../shared/models/referenceMaster.model';

const SEED_DATA = [
  // Department
  { masterType: 'department', code: 'SALES',              label: 'Sales',                 sortOrder: 1 },
  { masterType: 'department', code: 'SERVICE',            label: 'Service',               sortOrder: 2 },
  { masterType: 'department', code: 'SPARES_DISTRIBUTORS',label: 'Spares Distributors',   sortOrder: 3 },
  { masterType: 'department', code: 'SERVICE_SPARES',     label: 'Service/Spares',        sortOrder: 4 },
  { masterType: 'department', code: 'ECOM',               label: 'ECOM',                  sortOrder: 5 },
  { masterType: 'department', code: 'MOBILE_APP',         label: 'Mobile App',            sortOrder: 6 },
  { masterType: 'department', code: 'BAJAJ_RIDE_CONNECT', label: 'Bajaj Ride Connect',    sortOrder: 7 },
  { masterType: 'department', code: 'OTHERS',             label: 'Others',                sortOrder: 8 },

  // Case Nature
  { masterType: 'case_nature', code: 'COMPLAINT',  label: 'Complaint',  sortOrder: 1 },
  { masterType: 'case_nature', code: 'QUERY',      label: 'Query',      sortOrder: 2 },
  { masterType: 'case_nature', code: 'SUGGESTION', label: 'Suggestion', sortOrder: 3 },
  { masterType: 'case_nature', code: 'FEEDBACK',   label: 'Feedback',   sortOrder: 4 },

  // Priority
  { masterType: 'priority', code: 'HIGH',   label: 'High',   sortOrder: 1 },
  { masterType: 'priority', code: 'MEDIUM', label: 'Medium', sortOrder: 2 },
  { masterType: 'priority', code: 'LOW',    label: 'Low',    sortOrder: 3 },
];

async function seed() {
  await connectMongo();
  console.log('Connected to MongoDB. Seeding reference masters...');

  for (const item of SEED_DATA) {
    await ReferenceMasterModel.findOneAndUpdate(
      { masterType: item.masterType, code: item.code },
      { $set: item },
      { upsert: true, new: true },
    );
    console.log(`  ✓ ${item.masterType} / ${item.code}`);
  }

  console.log('Seed complete.');
  await closeMongo();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
