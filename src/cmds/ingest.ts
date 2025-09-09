import { makeProvider } from "../lib/starknet.js";
import { ddSendLogs } from "../lib/datadog.js";
import { loadConfig } from "../lib/config.js";
import { hash } from "starknet";

type DDLog = { message: string; ddtags?: string; [k: string]: any };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const command = "ingest";
export const describe = "Stream Starknet events to Datadog Logs";
export const builder = (y: any) =>
  y
    .option("from-block", { type: "string", desc: "Start at block number or 'latest'" })
    .option("lookback-blocks", { type: "number", default: 500, desc: "If from-block is omitted or 'latest', start N blocks behind head for the first pass" })
    .option("interval-ms", { type: "number", default: 1500, desc: "Polling interval between cycles" })
    .option("verbose", { type: "boolean", default: true })
    .option("sample", { type: "number", default: 2 })
    .option("dump", { type: "string" });

export const handler = async (argv: any) => {
  const provider = makeProvider();
  const { STARKNET_NETWORK = "mainnet", STARKY_CHUNK_SIZE = "300", STARKNET_RPC_URL, DD_SITE } = process.env;

  const cfg = loadConfig();
  const contracts = cfg.contracts ?? [];
  const excludeNames = cfg.excludeEventNames ?? [];
  const excludeSelectors = new Set(excludeNames.map((n) => hash.getSelectorFromName(n).toLowerCase()));

  // Pretty debug header
  if (argv.verbose) {
    const appBase = (DD_SITE && /^(datadoghq\.com|datadoghq\.eu)$/.test(DD_SITE)) ? `https://app.${DD_SITE}` : `https://${DD_SITE ?? "datadoghq.com"}`;
    const logsLink = new URL(`/logs?query=${encodeURIComponent("app:starky")}`, appBase).toString();
    console.log("🔧 Starky ingest");
    console.log("• RPC:", STARKNET_RPC_URL);
    console.log("• Network:", STARKNET_NETWORK);
    console.log("• Contracts:", contracts.length ? contracts : "(none → provider permitting, chain-wide)");
    console.log("• Excluding event names:", excludeNames);
    console.log("• Chunk size:", STARKY_CHUNK_SIZE);
    console.log("• Interval (ms):", argv["interval-ms"]);
    console.log("🔎 Logs Explorer:", logsLink);
  }

  // Resolve initial fromBlock
  let fromBlock: any;
  if (!argv["from-block"] || argv["from-block"] === "latest") {
    const head = await provider.getBlockNumber();
    const start = Math.max(0, head - Number(argv["lookback-blocks"]));
    fromBlock = { block_number: start };
    if (argv.verbose) console.log(`⏪ First pass from block #${start} (head ~#${head})`);
  } else {
    fromBlock = { block_number: Number(argv["from-block"]) };
    if (argv.verbose) console.log(`⏩ Starting from block #${fromBlock.block_number}`);
  }

  while (true) {
    try {
      const addresses = contracts.length ? contracts : [undefined];
      let sent = 0, fetched = 0;

      for (const addr of addresses) {
        let cont: string | undefined = undefined;
        do {
          const resp: any = await provider.getEvents({
            from_block: fromBlock,
            to_block: "latest",
            address: addr,
            chunk_size: Number(STARKY_CHUNK_SIZE),
            continuation_token: cont
          } as any);

          const events = resp.events ?? [];
          cont = resp.continuation_token;
          fetched += events.length;

          if (argv.verbose && cont) {
            console.log(`📥 page fetched=${events.length} (has more...)`);
          } else if (argv.verbose) {
            const label = addr ? addr.slice(0, 10) + "…" : "(no address filter)";
            console.log(`📦 fetched ${events.length} events for ${label}`);
          }

          const logs: DDLog[] = [];
          for (let i = 0; i < events.length; i++) {
            const e = events[i];
            const sel = (e.keys?.[0] ?? "").toLowerCase();
            if (sel && excludeSelectors.has(sel)) continue;

            const tags = [
              "app:starky",
              `network:${STARKNET_NETWORK}`,
              e.from_address ? `contract:${e.from_address}` : undefined,
              sel ? `selector:${sel}` : undefined,
            ].filter(Boolean).join(",");

            logs.push({
              message: "starknet_event",
              service: "starky",
              ddsource: "starknet",
              ddtags: tags,
              contract_address: e.from_address,
              event_selector: e.keys?.[0],
              event_name: "unknown",
              keys: e.keys,
              data: e.data,
              block_number: e.block_number,
              tx_hash: e.transaction_hash,
            });
          }

          if (logs.length) {
            await ddSendLogs(logs, { verbose: argv.verbose, preview: argv.sample, dumpFile: argv.dump as string | undefined });
            sent += logs.length;
          }
        } while (cont);
      }

      if (argv.verbose) console.log(`📈 cycle fetched=${fetched} sent=${sent}`);
      // After the first cycle, tail the head
      if (typeof fromBlock === "object") fromBlock = "latest";
      await sleep(Number(argv["interval-ms"]));
    } catch (err: any) {
      console.error("ingest error:", err?.response?.data ?? err.message);
      await sleep(Number(argv["interval-ms"]));
    }
  }
};
