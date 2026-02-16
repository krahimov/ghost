import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Haunting } from "../memory/haunting.js";
import { readPlan } from "../memory/plan.js";
import { PLANNER_SYSTEM_PROMPT } from "../prompts/planner.js";
import { logger } from "../utils/logger.js";

export async function runPlanner(
  haunting: Haunting,
  journal: string,
  reflections: string,
  plan: string,
): Promise<string> {
  const prompt = `Update the research plan based on the latest knowledge.

Read:
- journal.md (recent observations)
- reflections.md (accumulated knowledge)
- plan.md (current plan)

Then write the updated plan.md with:
- Completed items marked as done
- New objectives generated from findings
- Priorities reordered based on current knowledge state`;

  logger.info(`[planner] Updating plan for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        allowedTools: ["Read", "Write", "Glob"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 20,
        cwd: haunting.path,
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          logger.info(
            `[planner] Completed. Cost: $${message.total_cost_usd?.toFixed(4) ?? "unknown"}`,
          );
        } else {
          logger.error(`[planner] Failed: ${message.subtype}`);
        }
      }
    }
  } catch (err) {
    logger.error(`[planner] Query failed: ${err}`);
    throw err;
  }

  // The agent has written the updated plan.md directly
  return readPlan(haunting);
}
