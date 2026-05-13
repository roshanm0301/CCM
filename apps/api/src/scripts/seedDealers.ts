// =============================================================================
// Seed script — Dealers + Counter initialisation
//
// When to run: once per fresh MongoDB volume, or whenever dealer records need
// to be reset (e.g. after docker:down:volumes). Also required before using the
// "Select Dealer" modal in case registration — dealers must exist in MongoDB.
//
// Run via (from apps/api/):
//   npm run seed:dealers
//   — or —
//   npx tsx src/scripts/seedDealers.ts
//
// Idempotent: uses upsert on dealerCode so it is safe to re-run.
// Counter is only initialised if it does not already exist (seq is not reset).
// =============================================================================

import { connectMongo, closeMongo } from '../shared/database/mongo';
import { DealerModel } from '../shared/models/dealer.model';
import { CounterModel } from '../shared/models/counter.model';

// Dealer codes DLR-001 through DLR-008 match the canonical identifiers used in:
//   - MockInstallBaseAdapter.ts (vehicle dealerRef values)
//   - MockContextAdapter.ts (dealer detail resolution)
//   - PostgreSQL dealer user seeds (external_user_ref column)
//   - case.model.ts dealerRef field (now stored as string dealerCode)
const DEALERS = [
  {
    dealerCode:    'DLR-001',
    dealerName:    'Sharma Bajaj Motors',
    branchCode:    'MH-SBM-001-B1',
    branchName:    'Pune Main Branch',
    contactNumber: '020-24567890',
    address:       '12 MG Road, Camp',
    state:         'Maharashtra',
    city:          'Pune',
    pinCode:       '411005',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Commercial Vehicle', 'Chetak'],
  },
  {
    dealerCode:    'DLR-002',
    dealerName:    'Gujarat Bajaj Pvt Ltd',
    branchCode:    'GJ-GBP-002-B1',
    branchName:    'Ahmedabad Central',
    contactNumber: '079-26543210',
    address:       '45 CG Road, Navrangpura',
    state:         'Gujarat',
    city:          'Ahmedabad',
    pinCode:       '380009',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Probiking'],
  },
  {
    dealerCode:    'DLR-003',
    dealerName:    'Capital Bajaj Delhi',
    branchCode:    'DL-CBD-003-B1',
    branchName:    'South Delhi',
    contactNumber: '011-29876543',
    address:       '78 Lajpat Nagar II',
    state:         'Delhi',
    city:          'New Delhi',
    pinCode:       '110024',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Commercial Vehicle'],
  },
  {
    dealerCode:    'DLR-004',
    dealerName:    'Reddy Bajaj Automobiles',
    branchCode:    'AP-RBA-004-B1',
    branchName:    'Hyderabad East',
    contactNumber: '040-27654321',
    address:       '34 Secunderabad Road',
    state:         'Telangana',
    city:          'Hyderabad',
    pinCode:       '500003',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Chetak'],
  },
  {
    dealerCode:    'DLR-005',
    dealerName:    'Rajputana Bajaj',
    branchCode:    'RJ-RJB-005-B1',
    branchName:    'Jaipur Main',
    contactNumber: '0141-2345678',
    address:       '56 MI Road',
    state:         'Rajasthan',
    city:          'Jaipur',
    pinCode:       '302001',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Commercial Vehicle'],
  },
  {
    dealerCode:    'DLR-006',
    dealerName:    'Kerala Bajaj Centre',
    branchCode:    'KL-KBC-006-B1',
    branchName:    'Kochi',
    contactNumber: '0484-2345670',
    address:       '90 MG Road, Ernakulam',
    state:         'Kerala',
    city:          'Kochi',
    pinCode:       '682035',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Probiking'],
  },
  {
    dealerCode:    'DLR-007',
    dealerName:    'TN Bajaj Dealers',
    branchCode:    'TN-TBD-007-B1',
    branchName:    'Chennai West',
    contactNumber: '044-23456789',
    address:       'Plot 45 3rd Avenue, Anna Nagar',
    state:         'Tamil Nadu',
    city:          'Chennai',
    pinCode:       '600040',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Chetak'],
  },
  {
    dealerCode:    'DLR-008',
    dealerName:    'UP Bajaj Showroom',
    branchCode:    'UP-UBS-008-B1',
    branchName:    'Lucknow Main',
    contactNumber: '0522-2345678',
    address:       '23 Hazratganj',
    state:         'Uttar Pradesh',
    city:          'Lucknow',
    pinCode:       '226001',
    isActive:      true,
    productTypes:  ['Motorcycle', 'Commercial Vehicle'],
  },
];

async function seed() {
  await connectMongo();
  console.log('Connected to MongoDB. Seeding dealers...');

  let upsertedCount = 0;
  for (const dealer of DEALERS) {
    await DealerModel.findOneAndUpdate(
      { dealerCode: dealer.dealerCode },
      { $set: dealer },
      { upsert: true, new: true },
    );
    upsertedCount++;
    console.log(`  Upserted dealer: ${dealer.dealerCode} — ${dealer.dealerName}`);
  }

  // Initialise the case_id counter only if it does not already exist.
  // $setOnInsert ensures seq is only set to 0 on first-time creation; it is
  // never reset if the document already exists (preserves current sequence).
  const counterResult = await CounterModel.findOneAndUpdate(
    { _id: 'case_id' },
    { $setOnInsert: { seq: 0 } },
    { upsert: true, new: true },
  );
  if (counterResult) {
    console.log(`  Counter case_id ready (seq=${counterResult.seq})`);
  }

  console.log(`\nSeed complete. ${upsertedCount} dealer records upserted.`);
  await closeMongo();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
