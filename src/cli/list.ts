import { Command } from "commander";
import { listHauntings } from "../memory/haunting.js";
import { getHauntingStats } from "../memory/store.js";

export const listCommand = new Command("list")
  .description("List all hauntings with status")
  .action(() => {
    const hauntings = listHauntings();

    if (hauntings.length === 0) {
      console.log('No hauntings found. Run "ghost haunt <topic>" to create one.');
      return;
    }

    console.log("\n👻 Your Hauntings\n");

    for (const h of hauntings) {
      const stats = getHauntingStats(h.id);
      const statusIcon =
        h.config.status === "active"
          ? "🟢"
          : h.config.status === "paused"
            ? "🟡"
            : "⚪";

      console.log(`${statusIcon} ${h.config.name} (${h.id})`);
      console.log(`   ${h.config.description}`);
      console.log(
        `   Schedule: ${h.config.schedule.interval} | Depth: ${h.config.research.depth}`,
      );
      if (stats) {
        console.log(
          `   Cycles: ${stats.totalCycles} | Last run: ${stats.lastCycleAt ?? "never"}`,
        );
      }
      console.log();
    }
  });
