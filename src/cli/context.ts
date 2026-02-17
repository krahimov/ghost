import fs from "node:fs";
import { Command } from "commander";
import { query } from "@anthropic-ai/claude-agent-sdk";
import inquirer from "inquirer";
import {
  readContext,
  writeContext,
  hasContext,
  getGlobalContextPath,
  writeHauntingContext,
  hasHauntingContext,
} from "../memory/context.js";
import { loadHaunting, listHauntings } from "../memory/haunting.js";
import { logger } from "../utils/logger.js";

export const contextCommand = new Command("context")
  .description("View or edit researcher context (global or per-haunting)")
  .option("--edit", "Re-run the interactive context setup")
  .option("--haunting <slug>", "View or edit context for a specific haunting")
  .action(async (opts) => {
    // Per-haunting context
    if (opts.haunting) {
      try {
        const haunting = loadHaunting(opts.haunting);

        if (opts.edit) {
          // Edit per-haunting context
          const current = readContext(haunting);
          if (current) {
            console.log(`Current context for "${haunting.config.name}":\n`);
            console.log(current);
            console.log(`\n---\n`);
          }

          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "identity",
              message: "Who are you? (role, company, what you do):",
            },
            {
              type: "input",
              name: "building",
              message: "What are you building or working on?",
            },
            {
              type: "input",
              name: "position",
              message: "Strategic position? (competitors, differentiators, market):",
            },
            {
              type: "input",
              name: "needs",
              message: "What kind of research do you need for THIS project?",
            },
          ]);

          console.log(`\n🧠 Generating project context...\n`);

          const userInput = `Identity: ${answers.identity}
Building: ${answers.building}
Strategic Position: ${answers.position}
Research Needs: ${answers.needs}

Generate the context.md file.`;

          try {
            for await (const message of query({
              prompt: userInput,
              options: {
                systemPrompt: CONTEXT_GENERATION_PROMPT,
                allowedTools: [],
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                maxTurns: 3,
              },
            })) {
              if (message.type === "result" && message.subtype === "success" && message.result) {
                writeHauntingContext(haunting, message.result);
                console.log(`✅ Context updated for "${haunting.config.name}"\n`);
                console.log(message.result);
              }
            }
          } catch (err) {
            logger.error(`Failed to generate context: ${err}`);
          }
          return;
        }

        // Default: show per-haunting context
        const context = readContext(haunting);
        if (!context) {
          console.log(`No context found for "${haunting.config.name}".`);
          console.log(`Run "ghost context --haunting ${haunting.id} --edit" to set up.`);
          return;
        }

        console.log(`📋 Context for "${haunting.config.name}":\n`);
        console.log(context);
      } catch (err) {
        console.error(`Error: ${err}`);
        process.exit(1);
      }
      return;
    }

    // Global context
    if (opts.edit || !hasContext()) {
      if (!hasContext()) {
        console.log(`No researcher context found. Let's set that up.\n`);
      } else {
        console.log(`Current global context:\n`);
        console.log(readContext());
        console.log(`\n---\n`);
      }

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "identity",
          message: "Who are you? (role, company, what you do):",
        },
        {
          type: "input",
          name: "building",
          message: "What are you building or working on?",
        },
        {
          type: "input",
          name: "position",
          message: "Strategic position? (competitors, differentiators, market):",
        },
        {
          type: "input",
          name: "needs",
          message: "What kind of research do you need?",
        },
      ]);

      console.log(`\n🧠 Generating updated context...\n`);

      const userInput = `Identity: ${answers.identity}
Building: ${answers.building}
Strategic Position: ${answers.position}
Research Needs: ${answers.needs}

Generate the context.md file.`;

      try {
        for await (const message of query({
          prompt: userInput,
          options: {
            systemPrompt: CONTEXT_GENERATION_PROMPT,
            allowedTools: [],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: 3,
          },
        })) {
          if (message.type === "result" && message.subtype === "success" && message.result) {
            writeContext(message.result);
            console.log(`✅ Global context updated at ${getGlobalContextPath()}\n`);
            console.log(message.result);
          }
        }
      } catch (err) {
        logger.error(`Failed to generate context: ${err}`);
      }

      return;
    }

    // Default: show global context + list which hauntings have custom context
    const context = readContext();
    if (!context) {
      console.log(`No context found. Run "ghost context --edit" to set up.`);
      return;
    }

    console.log(`📋 Global context:\n`);
    console.log(context);

    // Show per-haunting context status
    const hauntings = listHauntings();
    if (hauntings.length > 0) {
      console.log(`\n--- Per-project context ---\n`);
      for (const h of hauntings) {
        const hasOwn = hasHauntingContext(h);
        const icon = hasOwn ? "📋" : "🔗";
        const label = hasOwn ? "custom context" : "using global";
        console.log(`  ${icon} "${h.config.name}" — ${label}`);
      }
      console.log(`\nEdit per-project context: ghost context --haunting <slug> --edit`);
    }
  });

const CONTEXT_GENERATION_PROMPT = `Generate a structured researcher context document in markdown. Output ONLY the markdown, no code fences.

# Researcher Context

## Identity
[1-2 sentences]

## What We're Building
[Key focus areas as bullets]

## Strategic Position
[Competitors, differentiators]

## Research Needs
[Priorities]`;
