import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { saveHauntingConfig } from "../config/index.js";

export const pauseCommand = new Command("pause")
  .argument("<haunting>", "Haunting slug")
  .description("Pause a haunting")
  .action((slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      haunting.config.status = "paused";
      saveHauntingConfig(haunting.path, haunting.config);
      console.log(`⏸️  Haunting "${haunting.config.name}" paused.`);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

export const resumeCommand = new Command("resume")
  .argument("<haunting>", "Haunting slug")
  .description("Resume a paused haunting")
  .action((slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      haunting.config.status = "active";
      saveHauntingConfig(haunting.path, haunting.config);
      console.log(`▶️  Haunting "${haunting.config.name}" resumed.`);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
