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
- context.md (researcher context — who the user is, if it exists)
- purpose.md (research purpose — why this topic matters to the user, if it exists)

Then write the updated plan.md with:
- Completed items marked as done
- New objectives generated from findings, framed for the user's specific needs
- Priorities reordered based on strategic importance to the user`;

  logger.info(`[planner] Updating plan for "${haunting.config.name}"`);

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: PLANNER_SYSTEM_PROMPT,
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

  return readPlan(haunting);
}
