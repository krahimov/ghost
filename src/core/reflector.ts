import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";
import { readReflections } from "../memory/reflections.js";
import { REFLECTOR_SYSTEM_PROMPT } from "../prompts/reflector.js";
import { logger } from "../utils/logger.js";

export async function runReflector(
  haunting: Haunting,
  journal: string,
  reflections: string,
): Promise<{ updatedReflections: string; trimmedJournal: string }> {
  const prompt = `The journal has grown beyond the token threshold and needs reflection/compression.

Read:
- journal.md (current journal with many observations)
- reflections.md (existing reflections, if any)

Then:
1. Write an updated reflections.md that synthesizes older observations into themes and patterns
2. Write a trimmed journal.md that only keeps the most recent observations

Current journal length: ${journal.length} characters (~${Math.round(journal.length / 4)} tokens)
Current reflections length: ${reflections.length} characters`;

  logger.info(`[reflector] Compressing journal for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: REFLECTOR_SYSTEM_PROMPT,
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
            `[reflector] Completed. Cost: $${message.total_cost_usd?.toFixed(4) ?? "unknown"}`,
          );
        } else {
          logger.error(`[reflector] Failed: ${message.subtype}`);
        }
      }
    }
  } catch (err) {
    logger.error(`[reflector] Query failed: ${err}`);
    throw err;
  }

  // The agent has written both files directly
  return {
    updatedReflections: readReflections(haunting),
    trimmedJournal: readJournal(haunting),
  };
}
