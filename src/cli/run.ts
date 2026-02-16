import { Command } from "commander";
import { loadHaunting, listHauntings } from "../memory/haunting.js";
import { runCycle } from "../core/cycle.js";
import { logger } from "../utils/logger.js";

export const runCommand = new Command("run")
  .argument("[haunting]", "Haunting slug to run")
  .option("--all", "Run all active hauntings")
  .description("Manually trigger a research cycle")
  .action(async (hauntingSlug: string | undefined, opts) => {
    if (opts.all) {
      const hauntings = listHauntings().filter(
        (h) => h.config.status === "active",
      );

      if (hauntings.length === 0) {
        console.log("No active hauntings found.");
        return;
      }

      console.log(`Running ${hauntings.length} active hauntings...\n`);

      for (const haunting of hauntings) {
        console.log(`\n--- ${haunting.config.name} ---`);
        try {
          const result = await runCycle(haunting);
          console.log(
            `✅ Done: ${result.observationsAdded} observations, reflected: ${result.reflected}`,
          );
        } catch (err) {
          console.error(`❌ Failed: ${err}`);
        }
      }
      return;
    }

    if (!hauntingSlug) {
      console.error("Please specify a haunting slug or use --all");
      process.exit(1);
    }

    try {
      const haunting = loadHaunting(hauntingSlug);

      if (haunting.config.status !== "active") {
        console.log(
          `Haunting "${haunting.config.name}" is ${haunting.config.status}. Use "ghost resume ${hauntingSlug}" to reactivate.`,
        );
        return;
      }

      console.log(
        `🔬 Running research cycle for "${haunting.config.name}"...\n`,
      );
      const result = await runCycle(haunting);

      console.log(`\n✅ Cycle complete!`);
      console.log(`   Observations added: ${result.observationsAdded}`);
      console.log(`   Reflected: ${result.reflected}`);
      console.log(`   Plan updated: ${result.planUpdated}`);
      console.log(`   Notifications sent: ${result.notificationsSent}`);
      if (result.error) {
        console.log(`   ⚠️  Error: ${result.error}`);
      }
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });
