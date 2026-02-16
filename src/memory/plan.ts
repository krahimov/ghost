import fs from "node:fs";
import path from "node:path";
import type { Haunting } from "./haunting.js";

export function readPlan(haunting: Haunting): string {
  const planPath = path.join(haunting.path, "plan.md");

  if (!fs.existsSync(planPath)) {
    return "";
  }

  return fs.readFileSync(planPath, "utf-8");
}

export function writePlan(haunting: Haunting, content: string): void {
  const planPath = path.join(haunting.path, "plan.md");
  fs.writeFileSync(planPath, content, "utf-8");
}
