import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { readJournal } from "../memory/journal.js";

export const journalCommand = new Command("journal")
  .argument("<haunting>", "Haunting slug")
  .option("--tail <n>", "Show only the last N lines", parseInt)
  .description("Show the current research journal")
  .action((slug: string, opts) => {
    try {
      const haunting = loadHaunting(slug);
      const journal = readJournal(haunting);

      if (!journal.trim()) {
        console.log("Journal is empty. Run a research cycle first.");
        return;
      }

      if (opts.tail) {
        const lines = journal.split("\n");
        console.log(lines.slice(-opts.tail).join("\n"));
      } else {
        console.log(journal);
      }
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
