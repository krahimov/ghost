import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex-api.js";
import { runCycle } from "./cycle-runner.js";
import crypto from "node:crypto";

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

async function main() {
  // The Agent SDK spawns `claude` as a subprocess. If this worker is launched
  // from within a Claude Code session, several env vars are inherited that
  // cause the subprocess to refuse to start ("cannot be launched inside
  // another session"). Clear all of them.
  for (const key of Object.keys(process.env)) {
    if (
      key === "CLAUDECODE" ||
      key.startsWith("CLAUDE_CODE_") ||
      key.startsWith("CURSOR_SPAWN")
    ) {
      delete process.env[key];
    }
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error(
      "Missing NEXT_PUBLIC_CONVEX_URL environment variable.\n" +
        "Set it to your Convex deployment URL (e.g., https://reminiscent-herring-418.convex.cloud)",
    );
    process.exit(1);
  }

  const convex = new ConvexHttpClient(convexUrl);

  console.log(`Ghost Worker started (${WORKER_ID})`);
  console.log(`Connected to Convex: ${convexUrl}`);
  console.log(`Polling for cycles every ${POLL_INTERVAL_MS / 1000}s...\n`);

  let running = false;

  const poll = async () => {
    if (running) return; // Skip if already processing a cycle

    try {
      const pending = await convex.query(api.worker.getPendingCycle, {});

      if (!pending) return;

      // In dev, the SDK can use Claude Code session auth (claude login).
      // In prod, users must set their API key in Settings.
      if (!pending.user.anthropicApiKey && !process.env.CLAUDE_DEV) {
        console.error(
          `✗ User has no Anthropic API key set. Failing cycle ${pending.cycle._id}.`,
        );
        await convex.mutation(api.cycles.complete, {
          id: pending.cycle._id,
          hauntingId: pending.cycle.hauntingId,
          observationsAdded: 0,
          sourcesFetched: 0,
          reflected: false,
          planUpdated: false,
          notificationsSent: 0,
          error:
            "No Anthropic API key set. Go to Settings and add your API key.",
        });
        return;
      }

      // Claim the cycle
      try {
        await convex.mutation(api.worker.claimCycle, {
          cycleId: pending.cycle._id,
          workerId: WORKER_ID,
        });
      } catch (err) {
        // Another worker may have claimed it
        console.log(`  Cycle already claimed, skipping.`);
        return;
      }

      running = true;
      console.log(
        `\n━━━ Picked up cycle for "${pending.haunting.name}" (${pending.cycle._id}) ━━━`,
      );

      await runCycle({
        cycleId: pending.cycle._id,
        hauntingId: pending.haunting._id as any,
        userId: pending.user._id as any,
        haunting: {
          _id: pending.haunting._id as any,
          name: pending.haunting.name,
          slug: pending.haunting.slug,
          description: pending.haunting.description,
          journal: pending.haunting.journal,
          reflections: pending.haunting.reflections,
          plan: pending.haunting.plan,
          context: pending.haunting.context,
          purpose: pending.haunting.purpose,
          research: pending.haunting.research,
          schedule: pending.haunting.schedule,
          reflectorConfig: pending.haunting.reflectorConfig ?? undefined,
        },
        anthropicApiKey: pending.user.anthropicApiKey,
        convex,
      });

      running = false;
    } catch (err) {
      running = false;
      console.error(`Poll error: ${err}`);
    }
  };

  // Start polling
  setInterval(poll, POLL_INTERVAL_MS);
  // Also run immediately
  poll();
}

main().catch((err) => {
  console.error("Worker fatal error:", err);
  process.exit(1);
});
