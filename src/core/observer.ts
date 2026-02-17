import fs from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";
import { OBSERVER_SYSTEM_PROMPT } from "../prompts/observer.js";
import { logger } from "../utils/logger.js";

export async function runObserver(
  haunting: Haunting,
  journal: string,
  reflections: string,
  context: string,
  purpose: string,
): Promise<string> {
  // Write context.md into the haunting directory so the agent can read it
  if (context) {
    fs.writeFileSync(path.join(haunting.path, "context.md"), context, "utf-8");
  }

  const prompt = `Process the new research results and update the journal.

Read the following files:
- journal.md (current observations)
- reflections.md (accumulated reflections)
- context.md (researcher context — who the user is, if it exists)
- purpose.md (research purpose — why this topic matters to the user, if it exists)
- All JSON files in sources/ directory (new research results from this cycle)

Then write the updated journal.md with new observations integrated.
Use context.md and purpose.md to calibrate priority assignments and frame implications.

Current journal length: ${journal.length} characters
Has reflections: ${reflections.length > 100 ? "yes" : "no"}
Has context: ${context ? "yes" : "no"}
Has purpose: ${purpose ? "yes" : "no"}`;

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

  return readJournal(haunting);
}
