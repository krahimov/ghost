import * as readline from "node:readline";
import { Command } from "commander";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";
import { readReflections } from "../memory/reflections.js";
import { readPlan } from "../memory/plan.js";
import { logger } from "../utils/logger.js";

function buildChatSystemPrompt(
  hauntingName: string,
  journal: string,
  reflections: string,
  plan: string,
): string {
  return `You are Ghost, a research analyst who has been continuously tracking the topic "${hauntingName}".

You have accumulated the following knowledge through systematic research:

## Reflections (High-level patterns and synthesis)
${reflections}

## Recent Journal (Detailed observations)
${journal}

## Current Research Plan
${plan}

When answering questions:
- Draw on your accumulated knowledge to provide informed, specific answers
- Cite specific observations and sources when making claims
- Synthesize across multiple observations to identify patterns and trends
- Be honest about what you don't know or what hasn't been researched yet
- Suggest what to research next if the question reveals a knowledge gap
- You can read files from the haunting directory for additional details if needed`;
}

export const chatCommand = new Command("chat")
  .argument("<haunting>", "Haunting slug to chat with")
  .description("Chat with Ghost about accumulated knowledge")
  .action(async (slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      const journal = readJournal(haunting);
      const reflections = readReflections(haunting);
      const plan = readPlan(haunting);

      console.log(`\n👻 Ghost Chat — "${haunting.config.name}"`);
      console.log(`Type your questions. Type "exit" or "quit" to leave.\n`);

      const systemPrompt = buildChatSystemPrompt(
        haunting.config.name,
        journal,
        reflections,
        plan,
      );

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let sessionId: string | undefined;

      const askQuestion = (): void => {
        rl.question("You: ", async (input) => {
          const trimmed = input.trim().toLowerCase();
          if (["exit", "quit", "q"].includes(trimmed)) {
            console.log("\n👻 Goodbye!\n");
            rl.close();
            return;
          }

          if (!input.trim()) {
            askQuestion();
            return;
          }

          try {
            process.stdout.write("\nGhost: ");

            for await (const message of query({
              prompt: input,
              options: {
                systemPrompt,
                allowedTools: ["Read", "Glob"],
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                maxTurns: 10,
                cwd: haunting.path,
                ...(sessionId ? { resume: sessionId } : {}),
              },
            })) {
              if (message.type === "system" && "session_id" in message) {
                sessionId = (message as any).session_id;
              }
              if (message.type === "assistant" && "content" in message) {
                // The SDK streams content — we collect the final result
              }
              if (message.type === "result" && message.subtype === "success") {
                console.log(message.result);
              }
            }

            console.log();
          } catch (err) {
            console.error(`\nError: ${err}\n`);
          }

          askQuestion();
        });
      };

      askQuestion();
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
