import { makeProvider } from "../lib/starknet.js";
import { ddSendLogs } from "../lib/datadog.js";
import { loadConfig } from "../lib/config.js";
import { EventMapper } from "../lib/event-mapper.js";
import { ABIFetcher } from "../lib/abi-fetcher.js";
import { hash, RpcProvider } from "starknet";

type DDLog = { message: string; ddtags?: string; [k: string]: any };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract function calls from transaction data
 */
function extractFunctionCalls(tx: any, abiFetcher: ABIFetcher): Array<{
  function_name: string;
  function_selector: string;
  contract_address: string;
  tx_hash: string;
  block_number: number;
  timestamp: string;
}> {
  const functionCalls: Array<{
    function_name: string;
    function_selector: string;
    contract_address: string;
    tx_hash: string;
    block_number: number;
    timestamp: string;
  }> = [];

  // Handle different transaction types
  const txType = (tx as any).type;
  const calldata = (tx as any).calldata;
  
  if ((txType === 'INVOKE' || txType === 'INVOKE_FUNCTION') && calldata) {
    // For invoke transactions, the first calldata element is usually the function selector
    if (calldata && calldata.length > 0) {
      const selector = calldata[0];
      const contractAddress = (tx as any).contract_address || (tx as any).sender_address;
      
      if (contractAddress && selector) {
        // Try to get function name from ABI
        let functionName = `function_${selector.slice(0, 8)}`;
        
        functionCalls.push({
          function_name: functionName,
          function_selector: selector,
          contract_address: contractAddress,
          tx_hash: tx.transaction_hash || tx.hash,
          block_number: tx.block_number || 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Handle internal calls in transaction receipts
  if ((tx as any).execution_resources && (tx as any).execution_resources.internal_calls) {
    for (const internalCall of (tx as any).execution_resources.internal_calls) {
      if (internalCall.contract_address && internalCall.calldata && internalCall.calldata.length > 0) {
        const selector = internalCall.calldata[0];
        const contractAddress = internalCall.contract_address;
        
        let functionName = `internal_${selector.slice(0, 8)}`;
        
        functionCalls.push({
          function_name: functionName,
          function_selector: selector,
          contract_address: contractAddress,
          tx_hash: tx.transaction_hash || tx.hash,
          block_number: tx.block_number || 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  return functionCalls;
}

/**
 * Get transactions from blocks and extract function calls
 */
async function getFunctionCallsFromBlocks(
  provider: RpcProvider, 
  fromBlock: any, 
  contracts: string[], 
  abiFetcher: ABIFetcher,
  verbose: boolean
): Promise<DDLog[]> {
  const logs: DDLog[] = [];
  
  try {
    // Get the latest block number
    const latestBlock = await provider.getBlockNumber();
    const startBlock = typeof fromBlock === 'object' ? fromBlock.block_number : (fromBlock === 'latest' ? latestBlock : Number(fromBlock));
    
    // Process only the latest few blocks to avoid overwhelming the RPC
    const maxBlocks = 10; // Limit to last 10 blocks for efficiency
    const actualStartBlock = Math.max(startBlock, latestBlock - maxBlocks);
    
    if (verbose) {
      console.log(`🔍 Scanning blocks ${actualStartBlock} to ${latestBlock} for function calls...`);
    }
    
    for (let currentBlock = actualStartBlock; currentBlock <= latestBlock; currentBlock++) {
      try {
        const block = await provider.getBlockWithTxs(currentBlock);
        
        if (block.transactions && block.transactions.length > 0) {
          for (const tx of block.transactions) {
            // Filter by contract addresses if specified
            if (contracts.length > 0) {
              const txContractAddress = (tx as any).contract_address || (tx as any).sender_address;
              const isRelevantTx = contracts.some(contract => 
                txContractAddress?.toLowerCase() === contract.toLowerCase()
              );
              if (!isRelevantTx) continue;
            }
            
            const functionCalls = extractFunctionCalls(tx, abiFetcher);
            
            // Only log if we found function calls
            if (functionCalls.length > 0 && verbose) {
              const txType = (tx as any).type;
              const txHash = (tx as any).transaction_hash?.slice(0, 10);
              const txContract = (tx as any).contract_address || (tx as any).sender_address;
              console.log(`🔍 Found ${functionCalls.length} function call(s) in ${txType} ${txHash}... to ${txContract?.slice(0, 10)}...`);
            }
            
            for (const call of functionCalls) {
              const tags = [
                "app:starky",
                "type:function_call",
                `contract:${call.contract_address}`,
                `function_selector:${call.function_selector}`,
              ].filter(Boolean).join(",");
              
              logs.push({
                message: "starknet_function_call",
                service: "starky",
                ddsource: "starknet",
                ddtags: tags,
                contract: call.contract_address,
                contract_address: call.contract_address,
                function_selector: call.function_selector,
                function_name: call.function_name,
                tx_hash: call.tx_hash,
                block_number: call.block_number,
                timestamp: call.timestamp,
              });
            }
          }
        }
      } catch (error) {
        if (verbose) {
          console.warn(`⚠️  Could not fetch block ${currentBlock}:`, error);
        }
      }
      
      // Small delay to avoid rate limiting
      await sleep(50);
    }
    
    if (verbose && logs.length > 0) {
      console.log(`✅ Found ${logs.length} function calls in scanned blocks`);
    }
    
  } catch (error) {
    if (verbose) {
      console.warn("⚠️  Error fetching function calls:", error);
    }
  }
  
  return logs;
}

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
  
  // Initialize ABI fetcher and event mapper
  const abiFetcher = new ABIFetcher(provider);
  const eventMapper = new EventMapper(cfg.contractABIs, abiFetcher, cfg.manualEventMappings);
  
  // Auto-load events from contracts
  if (contracts.length > 0) {
    await eventMapper.loadEventsFromContracts(contracts);
  }

  // Pretty debug header
  if (argv.verbose) {
    const appBase = (DD_SITE && /^(datadoghq\.com|datadoghq\.eu)$/.test(DD_SITE)) ? `https://app.${DD_SITE}` : `https://${DD_SITE ?? "datadoghq.com"}`;
    const logsLink = new URL(`/logs?query=${encodeURIComponent("app:starky")}`, appBase).toString();
    console.log("🔧 Starky ingest");
    console.log("• RPC:", STARKNET_RPC_URL);
    console.log("• Network:", STARKNET_NETWORK);
    console.log("• Contracts:", contracts.length ? contracts : "(none → provider permitting, chain-wide)");
    console.log("• Excluding event names:", excludeNames);
    console.log("• Contract ABIs loaded:", cfg.contractABIs?.length || 0);
    console.log("• Manual event mappings:", cfg.manualEventMappings?.length || 0);
    console.log("• Known event names:", eventMapper.getKnownEventNames().length);
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
      let sent = 0, fetched = 0, functionCallsSent = 0;

      // First, get function calls from blocks
      if (contracts.length > 0) {
        const functionCallLogs = await getFunctionCallsFromBlocks(
          provider, 
          fromBlock, 
          contracts, 
          abiFetcher, 
          argv.verbose
        );
        
        if (functionCallLogs.length > 0) {
          if (argv.verbose) {
            console.log(`📤 Sending ${functionCallLogs.length} function call logs to Datadog`);
            console.log("🔍 Sample function call log:", JSON.stringify(functionCallLogs[0], null, 2));
          }
          await ddSendLogs(functionCallLogs, { verbose: false, preview: argv.sample, dumpFile: argv.dump as string | undefined });
          functionCallsSent += functionCallLogs.length;
        }
      }

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

          if (argv.verbose && events.length > 0) {
            const label = addr ? addr.slice(0, 10) + "…" : "(no address filter)";
            console.log(`📦 Fetched ${events.length} events for ${label}`);
            if (cont) console.log(`   → has more pages...`);
          }

          const logs: DDLog[] = [];
          for (let i = 0; i < events.length; i++) {
            const e = events[i];
            const sel = (e.keys?.[0] ?? "").toLowerCase();
            if (sel && excludeSelectors.has(sel)) continue;

            // Debug: show event processing details (only first event per batch)
            if (argv.verbose && i === 0 && events.length > 0) {
              const eventName = eventMapper.getEventNameWithContext(e.keys?.[0] || "", e.from_address || "");
              console.log(`🎯 Sample event: "${eventName}" (${e.keys?.[0]?.slice(0, 10)}...) from block ${e.block_number}`);
            }

            const tags = [
              "app:starky",
              `network:${STARKNET_NETWORK}`,
              e.from_address ? `contract:${e.from_address}` : undefined,
              sel ? `selector:${sel}` : undefined,
            ].filter(Boolean).join(",");

            const eventName = eventMapper.getEventNameWithContext(e.keys?.[0] || "", e.from_address || "");
            
            logs.push({
              message: "starknet_event",
              service: "starky",
              ddsource: "starknet",
              ddtags: tags,
              contract: e.from_address,
              contract_address: e.from_address,
              event_selector: e.keys?.[0] || "unknown",
              event_name: eventName,
              keys: e.keys,
              data: e.data,
              block_number: e.block_number,
              tx_hash: e.transaction_hash,
              timestamp: new Date().toISOString(),
            });
          }

          if (logs.length) {
            if (argv.verbose) {
              console.log(`📤 Sending ${logs.length} logs to Datadog`);
            }
            
            // Show sample log structure for debugging
            if (logs.length > 0 && argv.verbose) {
              console.log("🔍 Sample log structure:", JSON.stringify(logs[0], null, 2));
            }
            await ddSendLogs(logs, { verbose: true, preview: argv.sample, dumpFile: argv.dump as string | undefined });
            sent += logs.length;
          }
        } while (cont);
      }

      if (argv.verbose) {
        if (functionCallsSent > 0) {
          console.log(`📈 Function calls: ${functionCallsSent} found and sent to Datadog`);
        }
        console.log(`📈 Events: ${fetched} fetched, ${sent} sent to Datadog`);
        if (fetched > 0 && sent === 0) {
          console.log(`⚠️  Warning: fetched events but sent 0 logs (check excludeEventNames filter)`);
        }
      }
      // After the first cycle, tail the head
      if (typeof fromBlock === "object") {
        const currentHead = await provider.getBlockNumber();
        fromBlock = { block_number: currentHead };
      } else if (typeof fromBlock === "number") {
        // Update to latest block for next cycle
        const currentHead = await provider.getBlockNumber();
        fromBlock = currentHead;
      }
      await sleep(Number(argv["interval-ms"]));
    } catch (err: any) {
      console.error("ingest error:", err?.response?.data ?? err.message);
      await sleep(Number(argv["interval-ms"]));
    }
  }
};
