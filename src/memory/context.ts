import fs from "node:fs";
import path from "node:path";
import { getGhostHome } from "../utils/paths.js";
import type { Haunting } from "./haunting.js";

// --- Global context (default template) ---

export function getGlobalContextPath(): string {
  return path.join(getGhostHome(), "context.md");
}

/** @deprecated Use readContextForHaunting() instead for per-haunting context */
export function getContextPath(): string {
  return getGlobalContextPath();
}

/**
 * Read context.md — checks per-haunting first, falls back to global.
 * If no haunting is provided, reads the global context only.
 */
export function readContext(haunting?: Haunting): string {
  // Per-haunting context takes priority
  if (haunting) {
    const hauntingContextPath = path.join(haunting.path, "context.md");
    if (fs.existsSync(hauntingContextPath)) {
      return fs.readFileSync(hauntingContextPath, "utf-8");
    }
  }

  // Fall back to global context
  const globalPath = getGlobalContextPath();
  if (!fs.existsSync(globalPath)) {
    return "";
  }
  return fs.readFileSync(globalPath, "utf-8");
}

export function writeContext(content: string): void {
  const contextPath = getGlobalContextPath();
  fs.writeFileSync(contextPath, content, "utf-8");
}

export function writeHauntingContext(haunting: Haunting, content: string): void {
  const contextPath = path.join(haunting.path, "context.md");
  fs.writeFileSync(contextPath, content, "utf-8");
}

export function hasContext(): boolean {
  return fs.existsSync(getGlobalContextPath());
}

export function hasHauntingContext(haunting: Haunting): boolean {
  return fs.existsSync(path.join(haunting.path, "context.md"));
}

/**
 * Copy the global context.md into a haunting's directory.
 * This gives each project its own editable copy.
 */
export function copyContextToHaunting(haunting: Haunting): void {
  const globalContext = readContext();
  if (globalContext) {
    writeHauntingContext(haunting, globalContext);
  }
}

export function readPurpose(haunting: Haunting): string {
  const purposePath = path.join(haunting.path, "purpose.md");

  if (!fs.existsSync(purposePath)) {
    return "";
  }

  return fs.readFileSync(purposePath, "utf-8");
}

export function writePurpose(haunting: Haunting, content: string): void {
  const purposePath = path.join(haunting.path, "purpose.md");
  fs.writeFileSync(purposePath, content, "utf-8");
}
