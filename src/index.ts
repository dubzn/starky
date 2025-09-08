#!/usr/bin/env node
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

yargs(hideBin(process.argv))
  .scriptName("starky")
  .command(await import("./cmds/board-create.js"))
  .command(await import("./cmds/board-add-contract.js"))
  .command(await import("./cmds/ingest.js"))
  .demandCommand(1)
  .strict()
  .help()
  .parse();
