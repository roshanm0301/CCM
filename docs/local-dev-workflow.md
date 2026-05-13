# Local development workflow (preferred for iterative work)

## ⚠️ HARD RULE — Two modes, never mixed

**Docker mode** and **Hybrid mode** both use port 3000 for the API. They MUST NOT run at the same time. Violating this causes "port already in use" errors.

| Mode | Who uses port 3000 | Who uses port 5173/8080 | Access URL |
|---|---|---|---|
| **Docker** (full stack) | `ccm-api` container | `ccm-web` container → port 8080 | `http://localhost:8080` |
| **Hybrid** (dev iteration) | Local `nodemon` process | Local Vite process → port 5173 | `http://localhost:5173` |

**Never start Docker stack while a local API is running. Never start local API while Docker ccm-api is running.**

## Switching from Hybrid → Docker (correct sequence)

```bash
# 1. Stop everything safely — script kills ports 3000 and 5173 before Docker starts
npm run docker:start          # first time or after code change (no image rebuild needed)
npm run docker:start:build    # when Dockerfile or package.json changed
npm run docker:rebuild:api    # when only API code changed and you want fast rebuild
# → Open http://localhost:8080
```

`docker:start` / `docker:start:build` / `docker:rebuild:api` all call `scripts/free-dev-ports.mjs`
first, which kills any local processes on ports 3000 and 5173 before Docker starts.
**No manual port killing ever needed.**

## Switching from Docker → Hybrid (correct sequence)

```bash
# 1. Stop Docker API and Web (keep DB containers running)
npm run docker:stop           # stops ccm-api, ccm-web — keeps postgres and mongo

# 2. Start local processes
npm run docker:db             # ensure DBs are running (no-op if already up)
npm run dev:local:api         # Terminal A — API with nodemon hot-reload
npm run dev:local:web         # Terminal B — Vite HMR dev server
# → Open http://localhost:5173
```

## When to use which approach

| Situation | Command | Access URL |
|---|---|---|
| User is testing / demoing | `npm run docker:start` | `:8080` |
| Only API code changed (no Dockerfile changes) | `npm run docker:rebuild:api` | `:8080` |
| Dockerfile, package.json, or new npm dep changed | `npm run docker:start:build` | `:8080` |
| Actively iterating on API or frontend code | Hybrid mode (see above) | `:5173` |
| Check container state | `npm run docker:status` | — |
| Watch API logs live | `npm run docker:logs:api` | — |

## How hybrid mode works

```
Docker (always running)        Host processes (hot-reload)
──────────────────────         ──────────────────────────
postgres → localhost:5432  ←── API (nodemon, port 3000)
mongo    → localhost:27017 ←──   └─ reads .env + .env.local
                                Web (Vite HMR, port 5173)
                                  └─ proxies /api → localhost:3000
```

- **Frontend changes** (`.tsx`, `.ts`, `.css`) → Vite HMR pushes to browser in < 1 second. No restart.
- **API changes** (`.ts`) → nodemon restarts in ~2 seconds. No rebuild.
- **Schema/migration changes** → requires `docker compose restart postgres` and re-running the migration SQL file.

## First-time setup — seed test users (run once per fresh database volume)

Migrations (001–105) run automatically when Postgres first starts. Test users are **not** in migrations; they live in separate seed files and must be applied manually the first time:

```bash
docker exec -i ccm-postgres psql -U ccm_user -d ccm < ops/seeds/dev/seed_test_users_dev_only.sql
docker exec -i ccm-postgres psql -U ccm_user -d ccm < ops/seeds/dev/seed_dealer1_test_user_dev_only.sql
docker exec -i ccm-postgres psql -U ccm_user -d ccm < ops/seeds/dev/seed_activity_flow_users_dev_only.sql
```

Run these **after** postgres is healthy (shown by `npm run docker:status`). You only need to do this once; data persists in the `postgres_data` Docker volume until you run `npm run docker:down:volumes`.

**Test credentials after seeding:**
- Agent: `agent1` / `Agent@123`
- Dealer: `dealer1` / `Dealer@123`

## First-time setup — seed MongoDB and provision TeleCMI agents (run once per fresh volume)

### MongoDB — Dealer records and case-ID counter

```bash
# From apps/api/
npm run seed:dealers
```

Required before agents can register cases (the "Select Dealer" modal queries MongoDB).

### TeleCMI — Agent CTI provisioning

```bash
# From apps/api/
npm run seed:cti-agents
```

Required for agents to use the CTI dialer and receive inbound calls. Without this step `GET /api/v1/cti/sdk-config` returns 404 and the piopiy WebRTC SDK never initialises — agents will see no dialer box and the inbound call flow will not trigger.

The script:
- Calls the TeleCMI REST API (`POST /v2/user/add`) for each unprovisioned agent user
- Assigns a SIP extension starting at 101 and stores it in the `users` table
- Is idempotent — re-running it safely skips already-provisioned agents

**Prerequisite:** `TELECMI_APP_SECRET` must be set in `.env` (non-empty). The script exits with an error if it is missing.

## Environment files

| File | Purpose | In git? |
|---|---|---|
| `.env` | All secrets. `POSTGRES_HOST=localhost`, `MONGO_HOST=localhost`, `MONGO_REPLICA_SET=rs0`. Docker Compose overrides the host vars for the `api` container via its `environment:` block — `.env` itself always uses `localhost`. | ❌ Never |
| `.env.local` | Loaded second by `nodemon.local.json` (overrides `.env`). Pins `POSTGRES_HOST=localhost`, `MONGO_HOST=localhost`, `MONGO_REPLICA_SET=rs0` explicitly for hybrid mode. | ❌ Never |

`apps/api/nodemon.local.json` loads **both** files in order using Node 22's `--env-file` flag (via tsx): `.env` first, then `.env.local`. The Docker `dev` script does NOT use `--env-file` — it relies on env vars injected by Docker Compose.

**Critical:** `MONGO_REPLICA_SET=rs0` must be present in `.env` (and `.env.local`). The mongo container runs with `--replSet rs0`. Without this variable the API builds a connection string that omits `?replicaSet=rs0` and Mongoose cannot discover the replica-set primary.

---

## Mandatory browser verification before confirming work is done
**Never confirm that a feature or fix is working based on code review alone.**

Before telling the user that any implementation is complete and working, you MUST follow this exact sequence:

### Path A — Local dev (hybrid workflow) verification
Use this when the user is actively iterating. Before opening the browser, Claude MUST start all three local dev processes if they are not already running:

**Step 0 — Auto-start local dev servers (run all three in background):**
```bash
# 1. Databases in Docker
npm run docker:db

# 2. API with hot-reload (background)
# Uses root script — builds @ccm/types first, then starts nodemon
npm run dev:local:api

# 3. Web with HMR (background)
npm run dev:local:web
```
Wait for the Vite dev server to print `Local: http://localhost:5173` before proceeding.

**Steps 1–5 — Browser verification:**
1. Open Chrome (via `mcp__Claude_in_Chrome__*` tools) and navigate to `http://localhost:5173`
2. Log in with credentials (`agent1` / `Agent@123`)
3. Perform the actual implemented operations — click buttons, fill forms, navigate flows
4. Observe real responses: UI state changes, error messages, success alerts
5. Only after all steps pass in the live browser may you tell the user "it is working"

No `/env-check` required for hybrid mode — the API and Web are running on the host and their state is directly visible from terminal output.

### Path B — Full Docker stack verification
Use this when the full Docker stack (config 4 or 5) is running at `http://localhost:8080`.

**Step 0 — Run `/env-check` first.**
Before opening the browser, run the `/env-check` skill to validate the Docker stack is healthy, migrations are applied, seed user exists, and reference data is present. If the verdict is NO-GO, resolve blockers before proceeding. Do not open the browser during a NO-GO state.

**Steps 1–6 — Browser verification (only after `/env-check` returns GO):**
1. Open Chrome (via `mcp__Claude_in_Chrome__*` tools) and navigate to `http://localhost:8080`
2. Log in with real credentials (`agent1` / `Agent@123`)
3. Perform the actual operations that were implemented — click buttons, fill forms, navigate flows
4. Observe real responses: HTTP status codes, UI state changes, error messages, success alerts
5. Verify the database state where relevant (interaction events, status changes, etc.)
6. Only after all steps pass in the live browser may you tell the user "it is working"

**This rule is non-negotiable.** A response like "the code looks correct so it should work" is not acceptable. If you cannot access the browser or the app is not running, say so explicitly and ask the user to verify manually — do not claim it works.

---

## Check your confidence level
Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence.
