import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "./haunting.js";

export function readReflections(haunting: Haunting): string {
  const reflectionsPath = path.join(haunting.path, "reflections.md");

  if (!fs.existsSync(reflectionsPath)) {
    return "";
  }

  return fs.readFileSync(reflectionsPath, "utf-8");
}

export function writeReflections(haunting: Haunting, content: string): void {
  const reflectionsPath = path.join(haunting.path, "reflections.md");
  fs.writeFileSync(reflectionsPath, content, "utf-8");
}
