import { ddCreateDashboard } from "../lib/datadog.js";
import fs from "fs";
import path from "path";

export const command = "board create <name>";
export const describe = "Create a Datadog dashboard";
export const builder = (y: any) => y.positional("name", { type: "string" });

export const handler = async (argv: any) => {
  const templatePath = path.resolve(process.cwd(), "packages/cli/shared/dashboard-templates/base.json");
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  template.title = argv.name;

  const res = await ddCreateDashboard(template);
  console.log(`✅ Dashboard created\nid: ${res.id}\nurl: ${res.url}`);
};
