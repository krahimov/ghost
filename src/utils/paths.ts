import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function getGhostHome(): string {
  if (process.env.GHOST_HOME) {
    return path.resolve(process.env.GHOST_HOME);
  }
  return path.join(os.homedir(), ".ghost");
}

export function getHauntingsDir(): string {
  return path.join(getGhostHome(), "hauntings");
}

export function getHauntingDir(slug: string): string {
  return path.join(getHauntingsDir(), slug);
}

export function getDbPath(): string {
  return path.join(getGhostHome(), "ghost.db");
}

export function slugify(text: string, maxLength = 60): string {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+$/, "");
  }

  return slug;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function getPidPath(): string {
  return path.join(getGhostHome(), "daemon.pid");
}

export function getDaemonLogPath(): string {
  return path.join(getGhostHome(), "daemon.log");
}
