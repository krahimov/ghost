import cron from "node-cron";
import { Command } from "commander";
import { listHauntings } from "../memory/haunting.js";
import { runCycle } from "../core/cycle.js";
import { logger } from "../utils/logger.js";

const INTERVAL_CRON: Record<string, string> = {
  hourly: "0 * * * *",
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
};

export const daemonCommand = new Command("daemon")
  .description("Start Ghost in daemon mode (runs scheduler)")
  .action(() => {
    console.log("👻 Ghost daemon starting...\n");

    const hauntings = listHauntings().filter(
      (h) => h.config.status === "active",
    );

    if (hauntings.length === 0) {
      console.log('No active hauntings. Create one with "ghost haunt <topic>"');
      return;
    }

    for (const haunting of hauntings) {
      const interval = haunting.config.schedule.interval;
      const cronExpr =
        haunting.config.schedule.cron ?? INTERVAL_CRON[interval] ?? INTERVAL_CRON.daily;

      console.log(
        `📅 Scheduled "${haunting.config.name}" — ${interval} (${cronExpr})`,
      );

      cron.schedule(cronExpr, async () => {
        logger.info(
          `[daemon] Triggered cycle for "${haunting.config.name}"`,
        );
        try {
          await runCycle(haunting);
        } catch (err) {
          logger.error(
            `[daemon] Cycle failed for "${haunting.config.name}": ${err}`,
          );
        }
      });
    }

    console.log(`\n👻 Daemon running. Press Ctrl+C to stop.\n`);

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\n👻 Daemon stopping...");
      process.exit(0);
    });
  });
