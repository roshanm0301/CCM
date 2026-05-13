# CCM â€” Seeded & Mock Data Reference

> **Purpose:** This file is the single reference for all data that is seeded, migrated, or mocked in the CCM application. Use it to verify test scenarios, debug search results, and check login credentials without digging through source files.
>
> **Maintenance rule:** Whenever master data or transaction data is added to any seed/migration/mock file, this document **must** be updated in the same commit.

---

## Table of Contents

1. [Login Credentials](#1-login-credentials)
2. [Reference / Lookup Values](#2-reference--lookup-values)
3. [Mock Customers â€” Install Base](#3-mock-customers--install-base)
4. [Mock Customers â€” Customer Master (Fallback)](#4-mock-customers--customer-master-fallback)
5. [Mock Dealers](#5-mock-dealers)
6. [Test Database Helpers](#6-test-database-helpers)
7. [Seeding Flow](#7-seeding-flow)
8. [File Index](#8-file-index)

---

## 1. Login Credentials

### 1.1 Phase 1 Core Users

> **Source:** `ops/seeds/dev/seed_test_users_dev_only.sql`
> **Environment:** Development & CI only â€” never staging or production.

| Username | Password | Role | User ID | Display Name | Initial Status |
|----------|----------|------|---------|--------------|----------------|
| `agent1` | `Agent@123` | `agent` | `a1000000-0000-0000-0000-000000000001` | Test Agent One | `offline` |
| `noaccess` | `NoAccess@123` | *(none)* | `a2000000-0000-0000-0000-000000000002` | Test No Access User | `offline` |

**Notes:**
- `agent1` is the primary test account used for all Phase 1 workflow verification.
- `noaccess` has no role assigned â€” use it to verify RBAC rejection (403) on protected endpoints.
- Passwords are stored as bcrypt (cost 10) hashes; the plaintext values above are for test use only.
- The seed file is mounted via Docker Compose. Uncomment the seed volume in `docker-compose.yml` to activate it on first container init.

### 1.2 Phase 5 â€” Activity Flow Users

> **Source:** `ops/seeds/dev/seed_activity_flow_users_dev_only.sql`
> **Environment:** Development only. Apply migration `020_create_activity_flow_roles.sql` first.

#### CCM Staff

| Username | Password | Role(s) | User ID | Display Name | Dealer |
|----------|----------|---------|---------|--------------|--------|
| `ccm_agent1` | `Test@123` | `ccm_agent`, `agent` | `b1000000-0000-0000-0000-000000000001` | CCM Agent One | â€” |
| `ccm_lead1` | `Test@123` | `ccm_team_lead` | `b1000000-0000-0000-0000-000000000002` | CCM Team Lead One | â€” |

> `ccm_agent1` carries both `ccm_agent` and `agent` (legacy) roles â€” it is the primary account for Activity Flow feature testing.

#### Dealer DLR-001 Users

| Username | Password | Role | User ID | Display Name |
|----------|----------|------|---------|--------------|
| `dlr1_sa1` | `Test@123` | `dealer_service_advisor` | `c1000000-0000-0000-0000-000000000001` | DLR1 Service Advisor |
| `dlr1_wc1` | `Test@123` | `dealer_workshop_controller` | `c1000000-0000-0000-0000-000000000002` | DLR1 Workshop Controller |
| `dlr1_pe1` | `Test@123` | `dealer_parts_executive` | `c1000000-0000-0000-0000-000000000003` | DLR1 Parts Executive |
| `dlr1_ce1` | `Test@123` | `dealer_crm_executive` | `c1000000-0000-0000-0000-000000000004` | DLR1 CRM Executive |
| `dlr1_we1` | `Test@123` | `dealer_warranty_executive` | `c1000000-0000-0000-0000-000000000005` | DLR1 Warranty Executive |
| `dlr1_sm1` | `Test@123` | `dealer_service_manager` | `c1000000-0000-0000-0000-000000000006` | DLR1 Service Manager |
| `dlr1_ba1` | `Test@123` | `dealer_bodyshop_advisor` | `c1000000-0000-0000-0000-000000000007` | DLR1 Bodyshop Advisor |
| `dlr1_et1` | `Test@123` | `dealer_ev_technician` | `c1000000-0000-0000-0000-000000000008` | DLR1 EV Technician |

#### Dealer DLR-002 Users

| Username | Password | Role | User ID | Display Name |
|----------|----------|------|---------|--------------|
| `dlr2_sa1` | `Test@123` | `dealer_service_advisor` | `c2000000-0000-0000-0000-000000000001` | DLR2 Service Advisor |
| `dlr2_wc1` | `Test@123` | `dealer_workshop_controller` | `c2000000-0000-0000-0000-000000000002` | DLR2 Workshop Controller |
| `dlr2_pe1` | `Test@123` | `dealer_parts_executive` | `c2000000-0000-0000-0000-000000000003` | DLR2 Parts Executive |
| `dlr2_ce1` | `Test@123` | `dealer_crm_executive` | `c2000000-0000-0000-0000-000000000004` | DLR2 CRM Executive |
| `dlr2_we1` | `Test@123` | `dealer_warranty_executive` | `c2000000-0000-0000-0000-000000000005` | DLR2 Warranty Executive |
| `dlr2_sm1` | `Test@123` | `dealer_service_manager` | `c2000000-0000-0000-0000-000000000006` | DLR2 Service Manager |
| `dlr2_ba1` | `Test@123` | `dealer_bodyshop_advisor` | `c2000000-0000-0000-0000-000000000007` | DLR2 Bodyshop Advisor |
| `dlr2_et1` | `Test@123` | `dealer_ev_technician` | `c2000000-0000-0000-0000-000000000008` | DLR2 EV Technician |

**Notes for Phase 5 users:**
- All Phase 5 passwords are `Test@123`.
- Dealer users carry `external_user_ref` = `DLR-001` or `DLR-002`.
- Only `ccm_agent1` (role `ccm_agent`) has access to the Activity Master and Activity Template APIs; all other Phase 5 users will receive a 403 until their roles are granted access.
- Phase 5 roles are seeded by migration `020_create_activity_flow_roles.sql`.

---

## 2. Reference / Lookup Values

> **Source:** `ops/migrations/011_seed_reference_values.sql`
> **Environment:** All environments (runs as part of the migration sequence).

These values populate the `reference_values` table and drive all UI dropdowns.

### 2.1 Search Filter Types

| Code | Label | Sort Order |
|------|-------|-----------|
| `mobile` | Mobile Number | 1 |
| `registration_number` | Registration Number | 2 |
| `customer_name` | Customer Name | 3 |
| `email` | Email Address | 4 |

### 2.2 Contact Reasons

| Code | Label | Sort Order |
|------|-------|-----------|
| `complaint` | Complaint | 1 |
| `query` | Query | 2 |
| `suggestion` | Suggestion | 3 |
| `feedback` | Feedback | 4 |
| `other` | Other | 5 |

### 2.3 Identification Outcomes

| Code | Label | Sort Order |
|------|-------|-----------|
| `customer_vehicle_identified` | Customer and Vehicle Identified | 1 |
| `customer_identified_vehicle_unresolved` | Customer Identified â€” Vehicle Unresolved | 2 |
| `vehicle_identified_customer_partially_resolved` | Vehicle Identified â€” Customer Partially Resolved | 3 |
| `no_verified_match` | No Verified Match | 4 |
| `multiple_matches_resolved_by_agent` | Multiple Matches â€” Resolved by Agent | 5 |

### 2.4 Interaction Dispositions

| Code | Label | Remarks Required? | Sort Order |
|------|-------|:-----------------:|-----------|
| `information_provided` | Information Provided | No | 1 |
| `information_captured` | Information Captured | No | 2 |
| `no_match_found` | No Match Found | **Yes** | 3 |
| `wrong_number` | Wrong Number | No | 4 |
| `silent_call` | Silent Call | No | 5 |
| `abusive_caller` | Abusive Caller | **Yes** | 6 |
| `technical_issue` | Technical Issue | **Yes** | 7 |
| `transferred_outside_ccm` | Transferred Outside CCM | No | 8 |
| `incomplete_interaction` | Incomplete Interaction | **Yes** | 9 |
| `others` | Others | **Yes** | 10 |

> **Remarks-required rule:** When a disposition marked "Yes" is selected in the wrap-up form, the Remarks field becomes mandatory. The form blocks save until remarks are entered.

### 2.5 Agent Statuses

| Code | Label | Sort Order |
|------|-------|-----------|
| `ready_for_calls` | Ready for Calls | 1 |
| `break` | Break | 2 |
| `offline` | Offline | 3 |
| `training` | Training | 4 |

---

## 3. Mock Customers â€” Install Base

> **Source:** `apps/api/src/modules/integration/MockInstallBaseAdapter.ts`
> **Environment:** All non-production environments (in-memory; no database entry).

Used by the Search API when real Install Base integration is not available.
Supports search by: **Mobile**, **Registration Number**, **Customer Name**, **Email** (all partial/case-insensitive).

### 3.1 Customer & Vehicle Records

| # | Customer Ref | Name | Mobile | Email | Vehicle Ref | Registration | Model | Variant | Chassis | Dealer Ref |
|---|-------------|------|--------|-------|-------------|-------------|-------|---------|---------|-----------|
| 1 | `CUST-IB-001` | Rahul Sharma | `9876543210` | rahul.sharma@email.com | `VEH-IB-001` | `MH12AB1234` | Bajaj Pulsar NS200 | NS200 FI | `MD2A11EZ9MCA00001` | `DLR-001` |
| 2 | `CUST-IB-002` | Priya Patel | `8765432109` | priya.patel@gmail.com | `VEH-IB-002` | `GJ01CD5678` | Bajaj Dominar 400 | Dominar 400 TS | `MD2A55BZ1NCA00002` | `DLR-002` |
| 3 | `CUST-IB-003` | Amit Kumar | `7654321098` | *(none)* | `VEH-IB-003` | `DL4CAF9876` | Bajaj Avenger Street 160 | Street 160 | `MD2A16AZ8LCA00003` | `DLR-003` |
| 3 | `CUST-IB-003` | Amit Kumar | `7654321098` | *(none)* | `VEH-IB-004` | `DL5CAG1122` | Bajaj Platina 110 | Platina 110 H-Gear | `MD2A11BZ3MCA00004` | `DLR-003` |
| 4 | `CUST-IB-004` | Sunita Reddy | `6543210987` | sunita.reddy@yahoo.com | `VEH-IB-005` | `AP28TG3344` | Bajaj CT100 | CT100 B | `MD2A10BZ9LCA00005` | `DLR-004` |
| 5 | `CUST-IB-005` | Vikram Singh | `9988776655` | vikram.singh@outlook.com | `VEH-IB-006` | `RJ14UC7890` | Bajaj Pulsar 150 | Pulsar 150 Twin Disc | `MD2A15EZ2NCA00006` | `DLR-005` |
| 6 | `CUST-IB-006` | Ekta Sire | `8087570780` | ektas@excellonsoft.com | `VEH-IB-007` | `KA53MN4455` | Bajaj Pulsar RS200 | RS200 FI ABS | `MD2A20EZ7MCA00007` | `DLR-002` |
| 7 | `CUST-IB-007` | Roshan | `8554982643` | roshanm@excellonsoft.com | `VEH-IB-008` | `KL07AS6677` | Bajaj Dominar 250 | Dominar 250 ABS | `MD2A25BZ4NCA00008` | `DLR-006` |
| 8 | `CUST-IB-008` | Kavitha Balachandran | `9123456780` | kavitha.b@techmail.com | `VEH-IB-009` | `TN22BG8899` | Bajaj Avenger Cruise 220 | Cruise 220 | `MD2A22AZ5MCA00009` | `DLR-007` |
| 9 | `CUST-IB-009` | Suresh Yadav | `8012345678` | *(none)* | `VEH-IB-010` | `UP32GH0011` | Bajaj CT125X | CT125X Drum | `MD2A12BZ6NCA00010` | `DLR-008` |
| 10 | `CUST-IB-010` | Mahabaleshwar | `8618546060` | anjali.mehta@business.in | `VEH-IB-011` | `MH43JK2233` | Bajaj Pulsar N160 | N160 Single Disc | `MD2A16GZ3NCA00011` | `DLR-001` |

> **Multi-vehicle customer:** Amit Kumar (`CUST-IB-003`) owns 2 vehicles (`VEH-IB-003` and `VEH-IB-004`). Use this customer to test multi-vehicle disambiguation.

### 3.2 Quick Search Reference

| Search Type | Example Value | Returns |
|------------|---------------|---------|
| Mobile | `9876543210` | Rahul Sharma (exact) |
| Mobile | `987` | Rahul Sharma (partial) |
| Mobile | `765` | Amit Kumar + Suresh Yadav (multiple results) |
| Reg. Number | `MH12AB1234` | Rahul Sharma / VEH-IB-001 |
| Reg. Number | `DL` | Amit Kumar (2 vehicles â€” both DL plates) |
| Customer Name | `sharma` | Rahul Sharma |
| Customer Name | `kumar` | Amit Kumar |
| Email | `gmail.com` | Priya Patel (single) |
| Email | `excellonsoft.com` | Ekta Sire + Roshan (multiple) |

---

## 4. Mock Customers â€” Customer Master (Fallback)

> **Source:** `apps/api/src/modules/integration/MockCustomerMasterAdapter.ts`
> **Environment:** All non-production environments (in-memory; no database entry).

Used as a fallback when the Install Base returns no results. Contains customer-only records (no vehicles or dealer links).
Supports search by: **Mobile**, **Customer Name**, **Email**. Does NOT support Registration Number.

| # | Customer Ref | Name | Mobile | Email |
|---|-------------|------|--------|-------|
| 1 | `CUST-CM-001` | Rajesh Gupta | `9001234567` | rajesh.gupta@email.com |
| 2 | `CUST-CM-002` | Pooja Verma | `8901234567` | pooja.verma@gmail.com |
| 3 | `CUST-CM-003` | Manish Tiwari | `7801234567` | *(none)* |
| 4 | `CUST-CM-004` | Nisha Agarwal | `6701234567` | nisha.agarwal@yahoo.com |
| 5 | `CUST-CM-005` | Sanjay Bhatt | `9601234567` | sanjay.bhatt@outlook.com |
| 6 | `CUST-CM-006` | Rekha Pillai | `8501234567` | rekha.pillai@rediffmail.com |
| 7 | `CUST-CM-007` | Arjun Desai | `7401234567` | arjun.desai@protonmail.com |
| 8 | `CUST-CM-008` | Latha Krishnan | `9301234567` | latha.krishnan@techmail.in |
| 9 | `CUST-CM-009` | Harish Chandra | `8201234567` | *(none)* |
| 10 | `CUST-CM-010` | Smita Kulkarni | `7101234567` | smita.kulkarni@business.in |

> **When to test with Customer Master data:** Search for a mobile number that exists ONLY in the CM list (e.g., `9001234567`). The result will show a customer card with no vehicle or dealer context.

---

## 5. Dealers — MongoDB Seeded + Mock Context

> **Source (MongoDB seed):** `apps/api/src/scripts/seedDealers.ts` — run `npm run seed:dealers` from `apps/api/`
> **Source (in-memory context):** `apps/api/src/modules/integration/MockContextAdapter.ts`
> **Environment:** All non-production environments.

Dealer codes `DLR-001` through `DLR-008` are the canonical identifiers used consistently across:
- MongoDB `dealers` collection (`dealerCode` field, seeded via `seedDealers.ts`)
- `MockInstallBaseAdapter.ts` (vehicle `dealerRef` values)
- `MockContextAdapter.ts` (dealer detail resolution for the context card)
- PostgreSQL dealer user seeds (`external_user_ref` column)
- MongoDB `cases` collection (`dealerRef` field — stored as dealer code string, not ObjectId)

| Dealer Code | Name | Branch | City | State | PIN | Product Types |
|------------|------|--------|------|-------|-----|--------------|
| `DLR-001` | Sharma Bajaj Motors | Pune Main Branch | Pune | Maharashtra | 411005 | Motorcycle, Commercial Vehicle, Chetak |
| `DLR-002` | Gujarat Bajaj Pvt Ltd | Ahmedabad Central | Ahmedabad | Gujarat | 380009 | Motorcycle, Probiking |
| `DLR-003` | Capital Bajaj Delhi | South Delhi | New Delhi | Delhi | 110024 | Motorcycle, Commercial Vehicle |
| `DLR-004` | Reddy Bajaj Automobiles | Hyderabad East | Hyderabad | Telangana | 500003 | Motorcycle, Chetak |
| `DLR-005` | Rajputana Bajaj | Jaipur Main | Jaipur | Rajasthan | 302001 | Motorcycle, Commercial Vehicle |
| `DLR-006` | Kerala Bajaj Centre | Kochi | Kochi | Kerala | 682035 | Motorcycle, Probiking |
| `DLR-007` | TN Bajaj Dealers | Chennai West | Chennai | Tamil Nadu | 600040 | Motorcycle, Chetak |
| `DLR-008` | UP Bajaj Showroom | Lucknow Main | Lucknow | Uttar Pradesh | 226001 | Motorcycle, Commercial Vehicle |

**Key mapping for dealer login:**

| Dealer User | `external_user_ref` | Dealer Name | City |
|------------|---------------------|-------------|------|
| `dealer1`, `dlr1_*` | `DLR-001` | Sharma Bajaj Motors | Pune |
| `dlr2_*` | `DLR-002` | Gujarat Bajaj Pvt Ltd | Ahmedabad |

**Dealer â†’ Customer mapping:**

| Dealer Ref | Customers served |
|-----------|-----------------|
| `DLR-001` | Rahul Sharma (`CUST-IB-001`), Mahabaleshwar (`CUST-IB-010`) |
| `DLR-002` | Priya Patel (`CUST-IB-002`), Ekta Sire (`CUST-IB-006`) |
| `DLR-003` | Amit Kumar (`CUST-IB-003`) â€” both vehicles |
| `DLR-004` | Sunita Reddy (`CUST-IB-004`) |
| `DLR-005` | Vikram Singh (`CUST-IB-005`) |
| `DLR-006` | Roshan (`CUST-IB-007`) |
| `DLR-007` | Kavitha Balachandran (`CUST-IB-008`) |
| `DLR-008` | Suresh Yadav (`CUST-IB-009`) |

---

## 6. Test Database Helpers

> **Source:** `apps/api/src/__tests__/helpers/testDb.ts`
> **Environment:** Integration tests only (never runs in the application).

These TypeScript helper functions are used by Vitest integration tests to create and tear down test data programmatically.

### 6.1 Seed Functions

| Function | Purpose | Default Values |
|----------|---------|---------------|
| `seedTestUser(username, passwordHash, displayName?, isActive?)` | Creates or upserts a user | displayName: "Test User", isActive: true |
| `assignAgentRole(userId)` | Gives agent role to a user | â€” |
| `seedInteraction(userId, status, correlationId?)` | Creates interaction in given status | correlationId: `test-corr-seed`, channel: `manual` |
| `seedWrapup(interactionId, userId, dispositionCode?, remarks?)` | Adds wrapup to interaction | disposition: `information_provided`, reason: `query`, outcome: `customer_vehicle_identified` |

### 6.2 Cleanup Functions

| Function | Removes |
|----------|---------|
| `removeTestUser(username)` | User + role assignments (cascades) |
| `cleanupInteractions(userId)` | All interactions + events + wrapups + search_attempts for user |
| `cleanupAgentStatus(userId)` | Agent status record |
| `cleanupUserAuditEvents(userId)` | Audit events not linked to an interaction |

### 6.3 Assertion Helpers

| Function | Returns |
|----------|---------|
| `countAuditEvents(interactionId, eventName?)` | Count of events (optionally filtered by name) |

### 6.4 Auth Helper (`testApp.ts`)

| Function | Returns |
|----------|---------|
| `loginAs(username, password)` | `{ cookieHeader, csrfToken, sessionCookie, loginResponse }` |
| `authedRequest(method, url, session)` | Supertest request with cookie + X-CSRF-Token pre-set |

---

## 7. Seeding Flow

### Local Development (Docker Compose)

```
docker compose up
  â””â”€ ccm-postgres container initializes
       â””â”€ /docker-entrypoint-initdb.d/*.sql executed in alphabetical order
            â”œâ”€ 001_create_users.sql           â€” schema
            â”œâ”€ 002_create_roles.sql           â€” schema
            â”œâ”€ ...
            â”œâ”€ 011_seed_reference_values.sql  â€” reference data (dispositions, statuses, etc.)
            â”œâ”€ 012_... to 014_...             â€” schema patches
            â””â”€ (seeds/dev/*.sql)             â€” uncomment volume in docker-compose.yml to activate
                 â””â”€ seed_test_users_dev_only.sql â€” agent1, noaccess
```

**To activate test users on a fresh container:**
1. Open `docker-compose.yml`
2. Uncomment the line: `# - ./ops/seeds/dev:/docker-entrypoint-initdb.d/seeds`
3. Run `docker compose down -v && docker compose up -d` (volume wipe required for init scripts to re-run)

### Integration Tests

```
vitest runs
  â””â”€ setupFiles: loadEnv.ts reads apps/api/.env.test
  â””â”€ each test calls testDb helpers:
       seedTestUser() â†’ assignAgentRole() â†’ seedInteraction() â†’ ...assertions... â†’ cleanup*()
```

### Production

Only schema migrations (`001â€“014`) execute. No test users, no mock adapters, no dev seeds.

---

## 8. File Index

| File | Type | What it seeds | Environments |
|------|------|--------------|-------------|
| `ops/migrations/011_seed_reference_values.sql` | SQL migration | All reference/lookup values (dropdowns) | All |
| `ops/seeds/dev/seed_test_users_dev_only.sql` | SQL dev seed | `agent1`, `noaccess` users | Dev, CI only |
| `apps/api/src/scripts/seedDealers.ts` | TS MongoDB seed | DLR-001 to DLR-008 dealers + case_id counter | Non-production (manual run) |
| `apps/api/src/modules/integration/MockInstallBaseAdapter.ts` | In-memory mock | 10 customers, 11 vehicles | Non-production |
| `apps/api/src/modules/integration/MockCustomerMasterAdapter.ts` | In-memory mock | 10 customers (no vehicles) | Non-production |
| `apps/api/src/modules/integration/MockContextAdapter.ts` | In-memory mock | 8 dealers + context aggregation | Non-production |
| `apps/api/src/__tests__/helpers/testDb.ts` | TS test helper | Dynamic seed/cleanup functions | Tests only |
| `apps/api/src/__tests__/helpers/testApp.ts` | TS test helper | Express app + loginAs helper | Tests only |

---

*Last updated: 2026-03-23. Update this file whenever any seed, migration, or mock data file changes.*
