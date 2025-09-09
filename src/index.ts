#!/usr/bin/env node
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

yargs(hideBin(process.argv))
  .scriptName("starky")
  .command(await import("./cmds/board.js")) 
  .command(await import("./cmds/ingest.js"))
  .strictCommands()
  .demandCommand(1)
  .help()
  .parse();
