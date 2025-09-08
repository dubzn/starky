import fs from "fs";
import path from "path";

export const command = "board <boardId> add contract <address>";
export const describe = "Add a contract address to the local watch list";
export const builder = (y: any) =>
  y
    .positional("boardId", { type: "string" })
    .positional("address", { type: "string" });

export const handler = async (argv: any) => {
  const file = path.resolve(process.cwd(), "packages/cli/shared/contracts.json");
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { boardId: argv.boardId, addresses: [] };

  if (!data.addresses.includes(argv.address)) {
    data.addresses.push(argv.address);
  }
  data.boardId = argv.boardId;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("✅ Contract added:", argv.address);
};
