import { Command } from "commander";
import { loadHaunting } from "../memory/haunting.js";
import { readPlan } from "../memory/plan.js";

export const planCommand = new Command("plan")
  .argument("<haunting>", "Haunting slug")
  .description("Show the current research plan")
  .action((slug: string) => {
    try {
      const haunting = loadHaunting(slug);
      const plan = readPlan(haunting);

      if (!plan.trim()) {
        console.log("Plan is empty. Run a research cycle first.");
        return;
      }

      console.log(plan);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
