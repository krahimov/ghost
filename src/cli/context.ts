import fs from "node:fs";
import { Command } from "commander";
import { query } from "@anthropic-ai/claude-agent-sdk";
import inquirer from "inquirer";
import { readContext, writeContext, hasContext, getContextPath } from "../memory/context.js";
import { logger } from "../utils/logger.js";

export const contextCommand = new Command("context")
  .description("View or edit your global researcher context")
  .option("--edit", "Re-run the interactive context setup")
  .action(async (opts) => {
    if (opts.edit || !hasContext()) {
      if (!hasContext()) {
        console.log(`No researcher context found. Let's set that up.\n`);
      } else {
        console.log(`Current context:\n`);
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
            systemPrompt: `Generate a structured researcher context document in markdown. Output ONLY the markdown, no code fences.

# Researcher Context

## Identity
[1-2 sentences]

## What We're Building
[Key focus areas as bullets]

## Strategic Position
[Competitors, differentiators]

## Research Needs
[Priorities]`,
            allowedTools: [],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: 3,
          },
        })) {
          if (message.type === "result" && message.subtype === "success" && message.result) {
            writeContext(message.result);
            console.log(`✅ Context updated at ${getContextPath()}\n`);
            console.log(message.result);
          }
        }
      } catch (err) {
        logger.error(`Failed to generate context: ${err}`);
      }

      return;
    }

    // Default: show current context
    const context = readContext();
    if (!context) {
      console.log(`No context found. Run "ghost context --edit" to set up.`);
      return;
    }

    console.log(context);
  });
