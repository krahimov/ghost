import { Command } from "commander";
import { loadHaunting, deleteHaunting, listHauntings } from "../memory/haunting.js";
import { releaseCycleLock } from "../core/cycle.js";

export const deleteCommand = new Command("delete")
  .argument("<haunting>", "Haunting slug to delete")
  .option("--force", "Skip confirmation")
  .description("Delete a haunting and all its data")
  .action((slug: string, opts) => {
    try {
      const haunting = loadHaunting(slug);

      // Release any lock first
      releaseCycleLock(haunting);

      if (!opts.force) {
        console.log(`\nAbout to delete: "${haunting.config.name}"`);
        console.log(`   Location: ${haunting.path}`);
        console.log(`   This will remove all journal, reflections, plan, and reports.`);
        console.log(`\n   Use --force to skip this warning.\n`);

        // For non-interactive, just do it with --force
        // For interactive, use stdin
        const readline = require("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question("   Type 'yes' to confirm: ", (answer: string) => {
          if (answer.trim().toLowerCase() === "yes") {
            deleteHaunting(slug);
            console.log(`\n🗑️  Deleted "${haunting.config.name}"\n`);
          } else {
            console.log("\n   Cancelled.\n");
          }
          rl.close();
        });
        return;
      }

      deleteHaunting(slug);
      console.log(`🗑️  Deleted "${haunting.config.name}"`);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
