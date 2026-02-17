import fs from "node:fs";
import { spawn } from "node:child_process";
import { Command } from "commander";
import { listHauntings } from "../memory/haunting.js";
import { runCycle, isCycleLocked } from "../core/cycle.js";
import { printCycleReport, generateReport } from "../core/report.js";
import { getHauntingStats } from "../memory/store.js";
import { getPidPath, getDaemonLogPath, getGhostHome } from "../utils/paths.js";
import { logger } from "../utils/logger.js";

// Interval durations in milliseconds
const INTERVAL_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

// How often the scheduler checks for due hauntings (60 seconds)
const SCHEDULER_TICK_MS = 60 * 1000;

// Track which hauntings we've already logged as "skipping" to avoid log spam
const skipLoggedFor = new Set<string>();

/**
 * Check if a haunting is due for a cycle based on its schedule and last run time.
 */
function isDue(hauntingId: string, interval: string): boolean {
  const stats = getHauntingStats(hauntingId);
  if (!stats?.lastCycleAt) return true; // Never run before → due immediately

  const lastRun = new Date(stats.lastCycleAt).getTime();
  const intervalMs = INTERVAL_MS[interval] ?? INTERVAL_MS.daily;
  const elapsed = Date.now() - lastRun;

  return elapsed >= intervalMs;
}

/**
 * The core scheduler loop. Runs every minute, checks all active hauntings,
 * and runs cycles for any that are due.
 */
async function runSchedulerTick(): Promise<void> {
  const hauntings = listHauntings().filter((h) => h.config.status === "active");

  for (const haunting of hauntings) {
    const interval = haunting.config.schedule.interval;

    if (!isDue(haunting.id, interval)) continue;
    if (isCycleLocked(haunting)) {
      // Only log once per lock period, not every tick
      if (!skipLoggedFor.has(haunting.id)) {
        logger.info(`[daemon] Skipping "${haunting.config.name}" — cycle already running`);
        skipLoggedFor.add(haunting.id);
      }
      continue;
    }

    // Clear the skip-logged flag when the lock is released
    skipLoggedFor.delete(haunting.id);

    logger.info(`[daemon] Running cycle for "${haunting.config.name}" (schedule: ${interval})`);

    try {
      const result = await runCycle(haunting);
      generateReport(haunting, result);
      logger.info(
        `[daemon] Cycle complete for "${haunting.config.name}": ${result.observationsAdded} observations`,
      );
    } catch (err) {
      logger.error(`[daemon] Cycle failed for "${haunting.config.name}": ${err}`);
    }
  }
}

/**
 * Start the scheduler in foreground mode (blocks the process).
 */
async function runForeground(): Promise<void> {
  console.log("👻 Ghost daemon starting (foreground)...\n");

  const hauntings = listHauntings().filter((h) => h.config.status === "active");

  if (hauntings.length === 0) {
    console.log('No active hauntings. Create one with "ghost haunt <topic>"');
    return;
  }

  // Show what's scheduled
  for (const haunting of hauntings) {
    const interval = haunting.config.schedule.interval;
    const stats = getHauntingStats(haunting.id);
    const lastRun = stats?.lastCycleAt
      ? new Date(stats.lastCycleAt).toLocaleString()
      : "never";
    const due = isDue(haunting.id, interval);

    console.log(
      `📅 "${haunting.config.name}" — ${interval} (last: ${lastRun})${due ? " ⚡ DUE NOW" : ""}`,
    );
  }

  console.log(`\n👻 Daemon running. Checking every 60s. Press Ctrl+C to stop.\n`);

  // Run immediately for anything that's due
  await runSchedulerTick();

  // Then schedule the tick every minute
  const tickInterval = setInterval(async () => {
    try {
      await runSchedulerTick();
    } catch (err) {
      logger.error(`[daemon] Scheduler tick failed: ${err}`);
    }
  }, SCHEDULER_TICK_MS);

  // Keep process alive, clean up on exit
  process.on("SIGINT", () => {
    clearInterval(tickInterval);
    console.log("\n👻 Daemon stopping...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(tickInterval);
    logger.info("[daemon] Received SIGTERM, shutting down");
    process.exit(0);
  });
}

// --- PID file management ---

function readPid(): number | null {
  const pidPath = getPidPath();
  if (!fs.existsSync(pidPath)) return null;
  try {
    const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePid(pid: number): void {
  fs.writeFileSync(getPidPath(), String(pid), "utf-8");
}

function removePid(): void {
  const pidPath = getPidPath();
  if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = just check if process exists
    return true;
  } catch {
    return false;
  }
}

// --- Daemon command with subcommands ---

export const daemonCommand = new Command("daemon")
  .description("Manage the Ghost background daemon")
  .action(async () => {
    // No subcommand = foreground mode
    await runForeground();
  });

daemonCommand
  .command("start")
  .description("Start the daemon in the background")
  .action(() => {
    // Check for existing daemon
    const existingPid = readPid();
    if (existingPid && isProcessRunning(existingPid)) {
      console.log(`👻 Daemon is already running (PID: ${existingPid})`);
      console.log(`   Stop it with "ghost daemon stop"`);
      return;
    }

    // Clean up stale PID if process is dead
    if (existingPid) removePid();

    const logPath = getDaemonLogPath();
    const logFd = fs.openSync(logPath, "a");

    // Fork the daemon process
    const child = spawn(
      process.execPath,
      [...process.execArgv, ...getEntryArgs()],
      {
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: { ...process.env, GHOST_DAEMON_MODE: "1" },
      },
    );

    if (child.pid) {
      writePid(child.pid);
      child.unref();
      console.log(`👻 Ghost daemon started (PID: ${child.pid})`);
      console.log(`   Logs: ${logPath}`);
      console.log(`   Stop: ghost daemon stop`);
      console.log(`   Status: ghost daemon status`);
    } else {
      console.error("Failed to start daemon");
      process.exit(1);
    }
  });

daemonCommand
  .command("stop")
  .description("Stop the background daemon")
  .action(() => {
    const pid = readPid();

    if (!pid) {
      console.log("👻 No daemon PID file found. Daemon may not be running.");
      return;
    }

    if (!isProcessRunning(pid)) {
      console.log(`👻 Daemon (PID: ${pid}) is not running. Cleaning up PID file.`);
      removePid();
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
      console.log(`👻 Daemon stopped (PID: ${pid})`);
      removePid();
    } catch (err) {
      console.error(`Failed to stop daemon (PID: ${pid}): ${err}`);
    }
  });

daemonCommand
  .command("status")
  .description("Check daemon status and scheduled hauntings")
  .action(() => {
    const pid = readPid();
    const running = pid && isProcessRunning(pid);

    if (running) {
      console.log(`👻 Daemon is RUNNING (PID: ${pid})`);
    } else {
      console.log(`👻 Daemon is NOT running`);
      if (pid) {
        console.log(`   Stale PID file found (${pid}). Run "ghost daemon start" to restart.`);
        removePid();
      }
    }

    const hauntings = listHauntings().filter((h) => h.config.status === "active");

    if (hauntings.length === 0) {
      console.log(`\nNo active hauntings.`);
      return;
    }

    console.log(`\n📋 Active hauntings (${hauntings.length}):\n`);

    for (const haunting of hauntings) {
      const interval = haunting.config.schedule.interval;
      const stats = getHauntingStats(haunting.id);
      const lastRun = stats?.lastCycleAt
        ? new Date(stats.lastCycleAt).toLocaleString()
        : "never";
      const cycles = stats?.totalCycles ?? 0;
      const due = isDue(haunting.id, interval);
      const locked = isCycleLocked(haunting);

      let status = "";
      if (locked) status = "🔄 RUNNING";
      else if (due) status = "⚡ DUE";
      else status = "⏳ waiting";

      console.log(`  ${status} "${haunting.config.name}"`);
      console.log(`       Schedule: ${interval} | Cycles: ${cycles} | Last: ${lastRun}`);

      if (!due && stats?.lastCycleAt) {
        const intervalMs = INTERVAL_MS[interval] ?? INTERVAL_MS.daily;
        const nextRunAt = new Date(new Date(stats.lastCycleAt).getTime() + intervalMs);
        console.log(`       Next run: ${nextRunAt.toLocaleString()}`);
      }
    }

    const logPath = getDaemonLogPath();
    if (fs.existsSync(logPath)) {
      console.log(`\n📄 Daemon log: ${logPath}`);
    }
  });

/**
 * Get the entry point arguments for spawning the daemon subprocess.
 * This reconstructs the command to run "ghost daemon" in background mode.
 */
function getEntryArgs(): string[] {
  // Find the actual entry file from process.argv
  // process.argv is typically: [node, script, ...args]
  // For tsx: [node, tsx-loader, script, ...args]
  // We need to run the same entry point with "daemon" as the command
  const args = process.argv.slice(1);

  // Find the index of "daemon" and its subcommand "start"
  // We want to replace "daemon start" with just "daemon" (foreground mode)
  const daemonIdx = args.findIndex((a) => a === "daemon");
  if (daemonIdx >= 0) {
    // Keep everything up to "daemon", drop "start"
    const entryArgs = args.slice(0, daemonIdx + 1);
    return entryArgs;
  }

  // Fallback: just use the original args but replace "start" with nothing
  return args.filter((a) => a !== "start");
}
