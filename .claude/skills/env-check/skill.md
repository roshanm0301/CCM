---
name: env-check
description: Validate the running Docker Compose stack before browser verification. Checks all container health statuses, API liveness and readiness endpoints, database connectivity, migration count, and seed user presence. Produces a go/no-go verdict before opening the browser. Run this before every mandatory browser verification step.
allowed-tools: Bash, Glob, Read
---

You are executing the `/env-check` skill for the CCM project.

## What this skill does

Systematically validates the local Docker Compose stack before any browser-based verification. Ensures that environment problems are not misdiagnosed as code problems. Produces a go/no-go verdict.

---

## Step 1 — Container health check

```bash
docker compose -f D:/excellongit/apt-iDMS-app-CCM/docker-compose.yml ps --format json 2>/dev/null || docker ps --filter "name=ccm" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected containers and their required status:

| Container | Required status |
|---|---|
| `ccm-postgres` | `Up` + `healthy` |
| `ccm-mongo` | `Up` + `healthy` |
| `ccm-api` | `Up` + `healthy` |
| `ccm-web` | `Up` + `healthy` |

If any container is not running or not healthy, this is a **GO BLOCKER**. Record which containers are unhealthy.

---

## Step 2 — API liveness check

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/live 2>/dev/null
```

Expected: `200`

If not 200, this is a **GO BLOCKER**. The API is not reachable.

---

## Step 3 — API readiness check (database connectivity)

```bash
curl -s http://localhost:3000/health/ready 2>/dev/null
```

Expected: HTTP 200 with a JSON body indicating both PostgreSQL and MongoDB are connected.

If readiness check fails or returns database error, this is a **GO BLOCKER**. The API cannot reach its databases.

---

## Step 4 — Stale image check (CRITICAL — run before all other checks)

The CCM docker-compose uses `target: production` for `ccm-api` and `ccm-web` with **no source volume mounts**. Code changes are compiled INTO the image at build time. A container that is `healthy` may be running stale code from before the last git commit.

**Always run this check first:**

```bash
# Get the image creation time for ccm-api and ccm-web
docker inspect ccm-api --format "ccm-api image built: {{.Created}}" 2>/dev/null
docker inspect ccm-web --format "ccm-web image built: {{.Created}}" 2>/dev/null

# Get the last git commit time
git -C D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm log -1 --format="Last code commit: %ci %s" 2>/dev/null
```

**Rule:** If the image build time is EARLIER than the last git commit time, the container is running stale code. This is a **GO BLOCKER** — a healthy container with stale code will return 404 for any new routes and ignore any changed business logic.

**Fix for stale images:**
```bash
# Rebuild only the stale service (no database wipe):
docker compose -f D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm/docker-compose.yml up --build --no-deps -d api
docker compose -f D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm/docker-compose.yml up --build --no-deps -d web
```

Wait for the container to return to `healthy` status before proceeding.

---

## Step 5 — Migration count check

Count the expected number of schema migrations:

```
Glob: pattern="ops/migrations/[0-9]*.sql"
```

Count how many `.sql` files exist whose names start with a number (exclude rollback files). This is the EXPECTED count.

Then check how many migrations have been applied to the database:

```bash
curl -s http://localhost:3000/health/ready 2>/dev/null
```

If the health endpoint exposes migration status, use it. If not, run:

```bash
docker exec ccm-postgres psql -U ccm_user -d ccm -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null
```

Compare the table count against the expected schema tables from `data-model-outline.md`:
- `users`, `roles`, `permissions`, `user_role_assignments`
- `interactions`, `interaction_wrapups`, `search_attempts`, `interaction_events`, `context_snapshots`
- `reference_values`, `agent_statuses`

If fewer tables exist than expected, migrations are incomplete. This is a **GO BLOCKER**.

---

## Step 6 — Seed user check

Verify the test agent account exists:

```bash
docker exec ccm-postgres psql -U ccm_user -d ccm -c "SELECT username, status FROM users WHERE username='agent1';" 2>/dev/null
```

Expected: one row returned with `status = 'active'`

If agent1 does not exist, login will fail and browser verification cannot proceed. This is a **GO BLOCKER** (but fixable by re-running seeds).

---

## Step 7 — Reference data check

Verify that master data picklists are seeded:

```bash
docker exec ccm-postgres psql -U ccm_user -d ccm -c "SELECT reference_type, COUNT(*) FROM reference_values GROUP BY reference_type;" 2>/dev/null
```

Expected reference types (from Phase 1 master data):
- `contact_reason` — 5 values (Complaint, Query, Suggestion, Feedback, Other)
- `identification_outcome` — 5 values
- `interaction_disposition` — 10 values
- `agent_status` — 4 values (Ready for Calls, Break, Offline, Training)
- `search_filter` — 4 values (Mobile, Registration Number, Customer Name, Email)

If any reference type is missing or has 0 rows, disposition capture and search will fail silently. This is a **GO BLOCKER**.

---

## Step 8 — Frontend accessibility check

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null
```

Expected: `200`

If not 200, the frontend is not serving. This is a **GO BLOCKER**.

---

## Step 9 — Produce go/no-go verdict

Output the environment check report:

```
ENVIRONMENT CHECK REPORT
=========================

Check time: [timestamp]

Container health:
  ccm-postgres: ✅ healthy / ❌ [status]
  ccm-mongo:    ✅ healthy / ❌ [status]
  ccm-api:      ✅ healthy / ❌ [status]
  ccm-web:      ✅ healthy / ❌ [status]

Image freshness:
  ccm-api image vs last commit:  ✅ image newer / ❌ STALE — rebuild required
  ccm-web image vs last commit:  ✅ image newer / ❌ STALE — rebuild required
API liveness (/health/live):       ✅ 200 / ❌ [status code]
API readiness (/health/ready):     ✅ databases connected / ❌ [error]
Schema tables present:             ✅ [n] tables / ❌ missing: [list]
Seed user agent1:                  ✅ active / ❌ missing
Reference data:
  contact_reason:           ✅ [n] rows / ❌ missing
  identification_outcome:   ✅ [n] rows / ❌ missing
  interaction_disposition:  ✅ [n] rows / ❌ missing
  agent_status:             ✅ [n] rows / ❌ missing
  search_filter:            ✅ [n] rows / ❌ missing
Frontend (http://localhost:8080):  ✅ 200 / ❌ [status code]

BLOCKERS: [none / list each blocker]

VERDICT: ✅ GO — environment is ready for browser verification
         ❌ NO-GO — resolve blockers before browser verification
```

---

## Step 10 — If NO-GO: provide fix guidance

For each blocker, provide the specific fix command:

| Blocker | Fix command |
|---|---|
| Stale image (api or web) | `docker compose -f D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm/docker-compose.yml up --build --no-deps -d api` (or `web`) |
| Container unhealthy | `docker compose -f D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm/docker-compose.yml up --build --no-deps -d [service]` |
| Migrations incomplete | `docker compose down -v && docker compose up --build -d` |
| agent1 not found | Re-run seed: check `ops/seeds/dev/` and mount it, or run seed SQL manually |
| Reference data missing | `docker exec ccm-postgres psql -U ccm_user -d ccm -f /path/to/011_seed_reference_values.sql` |
| Frontend 404 | `docker compose -f docker-compose.yml up --build web` |

Do NOT proceed to browser verification until the VERDICT is ✅ GO.

---

## Hard rules

- Never skip this check and open the browser directly. Environment failures waste time and create false bug reports.
- If docker commands fail with permissions errors, report that to the user and ask them to run the checks manually.
- Do not modify any container configuration, compose file, or migration as part of this skill. Report and fix guidance only.
- A NO-GO verdict must be resolved before any browser-based verification claim is made.
