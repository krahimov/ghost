import fs from "node:fs";
import { Command } from "commander";
import { query } from "@anthropic-ai/claude-agent-sdk";
import inquirer from "inquirer";
import { getGhostHome, ensureDir } from "../utils/paths.js";
import { saveGlobalConfig, DEFAULT_GLOBAL_CONFIG } from "../config/index.js";
import { getDatabase } from "../memory/store.js";
import { writeContext, hasContext, getContextPath } from "../memory/context.js";
import { logger } from "../utils/logger.js";

const CONTEXT_GENERATION_PROMPT = `You are Ghost, an autonomous research agent being set up for the first time. The user is telling you about themselves so you can be a more effective research analyst.

Based on the conversation below, generate a structured context.md file. This file will be used by all of Ghost's research agents to understand WHO the user is, WHAT they're building, and WHY they need research.

Output ONLY the markdown content, no code fences. Use this structure:

# Researcher Context

## Identity
[Who the user is — role, company, background. 1-2 sentences.]

## What We're Building
[What they're working on. Key focus areas as bullet points.]

## Strategic Position
[Competitors, differentiators, market position. What makes their situation unique.]

## Research Needs
[What kind of research matters most to them. What to prioritize and what to deprioritize.]`;

export const initCommand = new Command("init")
  .description("Initialize Ghost home directory and set up researcher context")
  .option("--skip-context", "Skip the interactive context setup")
  .action(async (opts) => {
    const ghostHome = getGhostHome();

    if (
      fs.existsSync(ghostHome) &&
      fs.existsSync(`${ghostHome}/config.yaml`)
    ) {
      console.log(`Ghost is already initialized at ${ghostHome}`);

      if (!hasContext() && !opts.skipContext) {
        console.log(`\nNo researcher context found. Let's set that up.\n`);
        await generateContext();
      }
      return;
    }

    ensureDir(ghostHome);
    ensureDir(`${ghostHome}/hauntings`);

    saveGlobalConfig(DEFAULT_GLOBAL_CONFIG);
    getDatabase(); // initializes tables

    console.log(`👻 Ghost initialized at ${ghostHome}`);
    console.log(`   Config: ${ghostHome}/config.yaml`);
    console.log(`   Database: ${ghostHome}/ghost.db`);

    if (!opts.skipContext) {
      console.log(`\nLet's set up your researcher context. This helps Ghost research like a personal analyst who understands your work.\n`);
      await generateContext();
    }

    console.log(`\nRun "ghost haunt <topic>" to start your first research mission.`);
  });

async function generateContext(): Promise<void> {
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
      message: "What's your strategic position? (competitors, differentiators, market):",
    },
    {
      type: "input",
      name: "needs",
      message: "What kind of research do you need? (priorities, what matters most):",
    },
  ]);

  console.log(`\n🧠 Generating your researcher context...\n`);

  const userInput = `Here's what the user told me about themselves:

Identity: ${answers.identity}
Building: ${answers.building}
Strategic Position: ${answers.position}
Research Needs: ${answers.needs}

Generate the context.md file.`;

  try {
    let contextContent = "";

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
      if (message.type === "result" && message.subtype === "success") {
        contextContent = message.result ?? "";
      }
    }

    if (contextContent) {
      writeContext(contextContent);
      console.log(`✅ Context saved to ${getContextPath()}`);
      console.log(`\n--- Your Researcher Context ---`);
      console.log(contextContent);
      console.log(`-------------------------------\n`);
      console.log(`Edit anytime with "ghost context --edit"`);
    }
  } catch (err) {
    logger.error(`Failed to generate context: ${err}`);
    console.log(`\n⚠️  Could not generate context automatically. You can create it manually at ${getContextPath()}`);
  }
}
