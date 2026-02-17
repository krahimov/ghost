import * as readline from "node:readline";
import { Command } from "commander";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal, parseObservations } from "../memory/journal.js";
import { readReflections } from "../memory/reflections.js";
import { readPlan } from "../memory/plan.js";
import { readContext, readPurpose } from "../memory/context.js";
import { logger } from "../utils/logger.js";

function buildChatSystemPrompt(
  hauntingName: string,
  journal: string,
  reflections: string,
  plan: string,
  context: string,
  purpose: string,
  sourceIndex: string,
): string {
  let prompt = `You are Ghost, a personal research analyst who has been continuously tracking the topic "${hauntingName}".
`;

  if (context) {
    prompt += `
## Who You're Working For
${context}
`;
  }

  if (purpose) {
    prompt += `
## Why This Research Matters
${purpose}
`;
  }

  prompt += `
## Reflections (High-level patterns and synthesis)
${reflections}

## Recent Journal (Detailed observations)
${journal}

## Current Research Plan
${plan}
`;

  if (sourceIndex) {
    prompt += `
## Source Index
The following sources were used across all observations. Use these to cite your answers:
${sourceIndex}
`;
  }

  prompt += `
## Response Guidelines

When answering questions:
- You understand the user's strategic position and frame answers accordingly
- Draw on your accumulated knowledge to provide informed, specific answers
- **ALWAYS cite sources** when making claims. Use the format [Source: URL] or reference the observation date
- When multiple sources support a claim, cite all of them
- Synthesize across multiple observations to identify patterns and trends
- Connect findings to the user's specific work, product, or strategic situation
- Be honest about what you don't know or what hasn't been researched yet
- Suggest what to research next if the question reveals a knowledge gap
- You can answer strategic questions like "what are the biggest threats to our approach?" or "where are the market gaps?"
- You can read files from the haunting directory for additional details (reports/, history/)
- At the end of detailed answers, include a "Sources:" section listing all URLs referenced`;

  return prompt;
}

function buildSourceIndex(journal: string): string {
  const observations = parseObservations(journal);
  if (observations.length === 0) return "";

  const sourceMap = new Map<string, string[]>();
  for (const obs of observations) {
    if (!sourceMap.has(obs.source)) {
      sourceMap.set(obs.source, []);
    }
    sourceMap.get(obs.source)!.push(`${obs.title} (${obs.date}, ${obs.priority})`);
  }

  let index = "";
  let i = 1;
  for (const [source, titles] of sourceMap) {
    index += `[${i}] ${source}\n`;
    for (const title of titles) {
      index += `    - ${title}\n`;
    }
    i++;
  }

  return index;
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
      const context = readContext();
      const purpose = readPurpose(haunting);
      const sourceIndex = buildSourceIndex(journal);

      const observations = parseObservations(journal);

      console.log(`\n👻 Ghost Chat — "${haunting.config.name}"`);
      console.log(`   Knowledge: ${observations.length} observations`);
      if (context) console.log(`   Context: loaded`);
      if (purpose) console.log(`   Purpose: loaded`);
      if (sourceIndex) {
        const sourceCount = (sourceIndex.match(/^\[\d+\]/gm) || []).length;
        console.log(`   Sources: ${sourceCount} indexed`);
      }
      console.log(`\nType your questions. Type "exit" or "quit" to leave.`);
      console.log(`Tip: Ask "what did you find?" or "what are the key threats?"\n`);

      const systemPrompt = buildChatSystemPrompt(
        haunting.config.name,
        journal,
        reflections,
        plan,
        context,
        purpose,
        sourceIndex,
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
