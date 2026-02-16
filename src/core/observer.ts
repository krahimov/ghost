import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";
import { OBSERVER_SYSTEM_PROMPT } from "../prompts/observer.js";
import { logger } from "../utils/logger.js";

export async function runObserver(
  haunting: Haunting,
  journal: string,
  reflections: string,
): Promise<string> {
  const prompt = `Process the new research results and update the journal.

Read the following files:
- journal.md (current observations)
- reflections.md (accumulated reflections)
- All JSON files in sources/ directory (new research results from this cycle)

Then write the updated journal.md with new observations integrated.

Current journal length: ${journal.length} characters
Has reflections: ${reflections.length > 100 ? "yes" : "no"}`;

  logger.info(`[observer] Processing research results for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: OBSERVER_SYSTEM_PROMPT,
        allowedTools: ["Read", "Write", "Glob"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 30,
        cwd: haunting.path,
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          logger.info(
            `[observer] Completed. Cost: $${message.total_cost_usd?.toFixed(4) ?? "unknown"}`,
          );
        } else {
          logger.error(`[observer] Failed: ${message.subtype}`);
        }
      }
    }
  } catch (err) {
    logger.error(`[observer] Query failed: ${err}`);
    throw err;
  }

  // The agent has written the updated journal.md directly
  return readJournal(haunting);
}
