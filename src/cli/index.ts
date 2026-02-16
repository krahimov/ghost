import { Command } from "commander";
import { initCommand } from "./init.js";
import { hauntCommand } from "./haunt.js";
import { runCommand } from "./run.js";
import { listCommand } from "./list.js";
import { statusCommand } from "./status.js";
import { chatCommand } from "./chat.js";
import { daemonCommand } from "./daemon.js";
import { journalCommand } from "./journal.js";
import { planCommand } from "./plan.js";
import { pauseCommand, resumeCommand } from "./pause.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("ghost")
    .description(
      "👻 Ghost — Autonomous research agent that compounds knowledge over time",
    )
    .version("0.1.0");

  program.addCommand(initCommand);
  program.addCommand(hauntCommand);
  program.addCommand(runCommand);
  program.addCommand(listCommand);
  program.addCommand(statusCommand);
  program.addCommand(chatCommand);
  program.addCommand(daemonCommand);
  program.addCommand(journalCommand);
  program.addCommand(planCommand);
  program.addCommand(pauseCommand);
  program.addCommand(resumeCommand);

  return program;
}
