import { makeProvider } from "../lib/starknet.js";
import { ddSendLogs } from "../lib/datadog.js";
import fs from "fs";
import path from "path";

type DDLog = { message: string; ddtags?: string; [k: string]: any };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const command = "ingest";
export const describe = "Stream Starknet events to Datadog Logs";
export const handler = async () => {
  const provider = makeProvider();
  const { STARKNET_NETWORK = "mainnet", STARKY_CHUNK_SIZE = "300" } = process.env;

  const contractsPath = path.resolve(process.cwd(), "packages/cli/shared/contracts.json");
  const contracts = fs.existsSync(contractsPath)
    ? JSON.parse(fs.readFileSync(contractsPath, "utf8")).addresses as string[]
    : [];

  let continuation_token: string | undefined;

  while (true) {
    try {
      const resp: any = await provider.getEvents({
        from_block: "latest",
        to_block: "latest",
        address: contracts.length ? contracts[0] : undefined, // MVP: un contrato
        keys: [],
        chunk_size: Number(STARKY_CHUNK_SIZE),
        continuation_token
      } as any);

      const events = resp.events ?? [];
      continuation_token = resp.continuation_token;

      if (events.length) {
        const logs: DDLog[] = events.map((e: any) => ({
          message: "starknet_event",
          ddtags: `app:starky,network:${STARKNET_NETWORK},contract:${e.from_address}`,
          contract_address: e.from_address,
          event_name: e.keys?.[0] ?? "unknown",
          keys: e.keys,
          data: e.data,
          block_number: e.block_number,
          tx_hash: e.transaction_hash
        }));
        await ddSendLogs(logs);
        console.log(`→ sent ${logs.length} logs`);
      }

      if (!continuation_token) await sleep(1500);
    } catch (err: any) {
      console.error("ingest error:", err?.response?.data ?? err.message);
      await sleep(3000);
    }
  }
};
