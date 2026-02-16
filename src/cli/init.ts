import fs from "node:fs";
import { Command } from "commander";
import { getGhostHome, ensureDir } from "../utils/paths.js";
import { saveGlobalConfig, DEFAULT_GLOBAL_CONFIG } from "../config/index.js";
import { getDatabase } from "../memory/store.js";
import { logger } from "../utils/logger.js";

export const initCommand = new Command("init")
  .description("Initialize Ghost home directory")
  .action(() => {
    const ghostHome = getGhostHome();

    if (
      fs.existsSync(ghostHome) &&
      fs.existsSync(`${ghostHome}/config.yaml`)
    ) {
      console.log(`Ghost is already initialized at ${ghostHome}`);
      return;
    }

    ensureDir(ghostHome);
    ensureDir(`${ghostHome}/hauntings`);

    saveGlobalConfig(DEFAULT_GLOBAL_CONFIG);
    getDatabase(); // initializes tables

    console.log(`👻 Ghost initialized at ${ghostHome}`);
    console.log(`   Config: ${ghostHome}/config.yaml`);
    console.log(`   Database: ${ghostHome}/ghost.db`);
    console.log(`\nRun "ghost haunt <topic>" to start your first research mission.`);
  });
