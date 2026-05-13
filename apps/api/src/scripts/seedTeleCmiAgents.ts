// =============================================================================
// Seed script — TeleCMI Agent Provisioning
//
// When to run: once per fresh PostgreSQL volume, or whenever agent users need
// TeleCMI credentials provisioned (e.g. after docker:down:volumes).
// Without TeleCMI credentials, agents will see 404 from /api/v1/cti/sdk-config
// and the piopiy WebRTC SDK will not initialise — no dialer and no inbound call
// handling.
//
// Run via (from apps/api/):
//   npm run seed:cti-agents
//   — or —
//   npx tsx src/scripts/seedTeleCmiAgents.ts
//
// Idempotent: skips any user that already has telecmi_extension set.
// Requires TELECMI_APP_ID and TELECMI_APP_SECRET to be set in .env (or
// environment) — if TeleCMI credentials are absent the script will exit
// with an error rather than silently skipping.
// =============================================================================

import { getPool, closePool } from '../shared/database/postgres';
import { provisionTeleCmiAgent } from '../modules/cti/cti.agent.service';
import { getCtiConfig } from '../modules/cti/cti.config';

interface AgentUserRow {
  id: string;
  username: string;
  display_name: string;
  telecmi_extension: number | null;
}

async function seed() {
  // Guard: fail fast if TeleCMI credentials are not configured.
  // Without these the addTeleCmiAgent REST call will fail for every agent.
  const ctiConfig = getCtiConfig();
  if (!ctiConfig.appSecret) {
    console.error(
      'ERROR: TELECMI_APP_SECRET is not set in .env — cannot provision TeleCMI agents.\n' +
        'Set TELECMI_APP_ID and TELECMI_APP_SECRET in .env and re-run.',
    );
    process.exit(1);
  }

  const pool = getPool();

  // Find all users that have the 'agent' role but no TeleCMI extension yet.
  const result = await pool.query<AgentUserRow>(
    `SELECT u.id, u.username, u.display_name, u.telecmi_extension
     FROM users u
     JOIN user_role_assignments ura ON ura.user_id = u.id
     JOIN roles r ON r.id = ura.role_id
     WHERE r.name = 'agent'
       AND u.is_active = TRUE
     ORDER BY u.username`,
  );

  const users = result.rows;

  if (users.length === 0) {
    console.log('No active agent users found. Nothing to provision.');
    await closePool();
    return;
  }

  console.log(`Found ${users.length} agent user(s). Provisioning unprovisioned agents...`);

  let provisionedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    if (user.telecmi_extension !== null) {
      console.log(`  SKIP  ${user.username} (${user.display_name}) — already provisioned (ext: ${user.telecmi_extension})`);
      skippedCount++;
      continue;
    }

    process.stdout.write(`  PROV  ${user.username} (${user.display_name}) — provisioning... `);
    try {
      await provisionTeleCmiAgent(user.id);

      // Re-fetch to show the assigned extension
      const check = await pool.query<{ telecmi_extension: number | null; telecmi_agent_id: string | null }>(
        'SELECT telecmi_extension, telecmi_agent_id FROM users WHERE id = $1',
        [user.id],
      );
      const row = check.rows[0];
      if (row?.telecmi_extension) {
        console.log(`OK (ext: ${row.telecmi_extension}, agentId: ${row.telecmi_agent_id ?? 'n/a'})`);
        provisionedCount++;
      } else {
        // provisionTeleCmiAgent logs errors internally and doesn't re-throw —
        // this path means TeleCMI responded with an error but didn't throw.
        console.log('WARN — extension still null after provisioning. TeleCMI API likely rejected the request (check Winston logs above for detail). Fix credentials in .env and re-run.');
      }
    } catch (err) {
      console.log(`FAIL — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\nSeed complete. Provisioned: ${provisionedCount}, Skipped (already provisioned): ${skippedCount}.`,
  );

  await closePool();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
