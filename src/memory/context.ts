import fs from "node:fs";
import path from "node:path";
import { getGhostHome } from "../utils/paths.js";
import type { Haunting } from "./haunting.js";

export function getContextPath(): string {
  return path.join(getGhostHome(), "context.md");
}

export function readContext(): string {
  const contextPath = getContextPath();

  if (!fs.existsSync(contextPath)) {
    return "";
  }

  return fs.readFileSync(contextPath, "utf-8");
}

export function writeContext(content: string): void {
  const contextPath = getContextPath();
  fs.writeFileSync(contextPath, content, "utf-8");
}

export function hasContext(): boolean {
  return fs.existsSync(getContextPath());
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
