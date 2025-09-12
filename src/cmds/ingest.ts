import { makeProvider } from "../lib/starknet.js";
import { ddSendLogs } from "../lib/datadog.js";
import { loadConfig, loadContractsFromABI } from "../lib/config.js";
import { EventMapper } from "../lib/event-mapper.js";
import { ABIParser, FunctionInfo } from "../lib/abi-parser.js";
import { hash, RpcProvider, num } from "starknet";

type DDLog = { message: string; ddtags?: string; [k: string]: any };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract function names from transaction calldata using dictionaries
 */
function extractFunctionNamesFromTx(tx: any, functionSelectorDict: { [key: string]: string }): string[] {
  const functionNames: string[] = [];
  const calldata = (tx as any).calldata || [];
  
  const selectors: string[] = [];
  
  // Buscar en todo el calldata elementos que coincidan exactamente con nuestros selectores
  for (let i = 0; i < calldata.length; i++) {
    const data = calldata[i];
    if (data && data.startsWith('0x')) {
      // Verificar si este elemento es exactamente uno de nuestros selectores de función
      if (functionSelectorDict[data]) {
        selectors.push(data);
      }
    }
  }
  
  
  for (const selector of selectors) {
    // Usar diccionario para búsqueda rápida
    const functionName = functionSelectorDict[selector];
    if (functionName) {
      functionNames.push(functionName);
    }
  }
  return functionNames;
}

/**
 * Extract function calls from transaction data using dictionaries
 */
function extractFunctionCalls(tx: any, functionSelectorDict: { [key: string]: string }, verbose: boolean = false): Array<{
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

  const txType = (tx as any).type;
  const calldata = (tx as any).calldata;
  const contractAddress = (tx as any).contract_address || "0x0";
  
  
  if ((txType === 'INVOKE' || txType === 'INVOKE_FUNCTION') && calldata && contractAddress) {
    // Use dictionary for function name extraction
    const functionNames = extractFunctionNamesFromTx(tx, functionSelectorDict);
    
    if (functionNames.length > 0) {
      // Extract the target contract address from calldata (position 1)
      const targetContractAddress = calldata.length > 1 ? calldata[1] : contractAddress;
      
      // Create function call entries for each identified function
      for (const functionName of functionNames) {
        try {
          const selector = hash.getSelectorFromName(functionName);
          
          functionCalls.push({
            function_name: functionName,
            function_selector: selector,
            contract_address: targetContractAddress,
            tx_hash: tx.transaction_hash || tx.hash,
            block_number: tx.block_number || 0,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          // If we can't get the selector, skip this function
        }
      }
    } else {
      // Fallback: if no functions identified, try to extract from first calldata element
      if (calldata && calldata.length > 0) {
        const selector = calldata[0];
        const targetContractAddress = calldata.length > 1 ? calldata[1] : contractAddress;
        if (selector && selector.startsWith('0x')) {
          functionCalls.push({
            function_name: `function_${selector.slice(0, 8)}`,
            function_selector: selector,
            contract_address: targetContractAddress,
            tx_hash: tx.transaction_hash || tx.hash,
            block_number: tx.block_number || 0,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  // Handle internal calls in transaction receipts
  if ((tx as any).execution_resources && (tx as any).execution_resources.internal_calls) {
    for (const internalCall of (tx as any).execution_resources.internal_calls) {
      if (internalCall.contract_address && internalCall.calldata && internalCall.calldata.length > 0) {
        const selector = internalCall.calldata[0];
        const contractAddress = internalCall.contract_address;
        
        // Try to identify the function name using dictionary
        let functionName = `internal_${selector.slice(0, 8)}`;
        
        const dictFunctionName = functionSelectorDict[selector];
        if (dictFunctionName) {
          functionName = dictFunctionName;
        }
        
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
 * Get function calls from events by fetching their transactions
 */
async function getFunctionCallsFromEvents(
  provider: RpcProvider, 
  events: any[], 
  contracts: string[], 
  functionSelectorDict: { [key: string]: string },
  verbose: boolean = false
): Promise<DDLog[]> {
  const logs: DDLog[] = [];
  const processedTxs = new Set<string>(); // Avoid processing the same transaction multiple times
  
  try {
    for (const event of events) {
      const txHash = event.transaction_hash;
      if (!txHash || processedTxs.has(txHash)) {
        continue; // Skip if no tx hash or already processed
      }
      
      processedTxs.add(txHash);
      
      try {
        // Get transaction by hash
        const tx = await provider.getTransactionByHash(txHash);
        
        if (!tx) {
          continue;
        }
        
        const functionCalls = extractFunctionCalls(tx, functionSelectorDict, false);

        // Log function calls with the correct format (like TX ANALYZER)
        for (const call of functionCalls) {
          logs.push({
            message: "starknet_function_call",
            service: "starky",
            ddsource: "starknet",
            ddtags: [
              "app:starky",
              "type:function_call",
              `contract:${call.contract_address}`
            ].filter(Boolean).join(","),
            contract: call.contract_address,
            type: "function_call",
            function_name: call.function_name,
            function_selector: call.function_selector,
            tx_hash: call.tx_hash,
            timestamp: call.timestamp,
          });
        }
        
        // Small delay to avoid rate limiting
        await sleep(50);
        
      } catch (error) {
        // Silent fail
      }
    }
    
  } catch (error) {
    // Silent fail
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
    .option("verbose", { type: "boolean", default: false })

export const handler = async (argv: any) => {
  const provider = makeProvider();
  const { STARKNET_NETWORK, STARKY_CHUNK_SIZE, STARKNET_RPC_URL, DD_SITE } = process.env;

  const cfg = loadConfig();
  
  // Load contracts and events from ABI
  let contracts: string[] = [];
  let eventNames: string[] = [];
  let abiParser: ABIParser | undefined;
  
  try {
    // Initialize ABI parser
    abiParser = new ABIParser(cfg.abiFile);
    await abiParser.loadABI();
    
    // Get event names from ABI
    eventNames = abiParser.getAllEvents().map(event => event.name);
    
    // Always use contracts from config (populated by setup command)
    contracts = cfg.contracts ?? [];
    
    console.log(`✅ Loaded ${contracts.length} contracts and ${eventNames.length} events from ABI`);
    
    if (contracts.length === 0) {
      console.log(`⚠️  No contract addresses configured. Run 'starky setup --abi-file <path>' first`);
      console.log(`   For contract classes, manually add 'contracts' array to config`);
      console.log(`   Example: "contracts": ["0x123...", "0x456..."]`);
    }
  } catch (error) {
    console.warn(`⚠️  Failed to load ABI:`, error);
    
    // Fallback to legacy configuration
    contracts = cfg.contracts ?? [];
    eventNames = cfg.eventNames ?? [];
  }
  
  // Initialize event mapper
  const eventMapper = new EventMapper(abiParser);
  
  // Auto-load events from contracts (legacy support)
  if (contracts.length > 0 && !abiParser) {
    await eventMapper.loadEventsFromContracts(contracts);
  }

  // Pretty debug header
  if (argv.verbose) {
    const appBase = (DD_SITE && /^(datadoghq\.com|datadoghq\.eu)$/.test(DD_SITE)) ? `https://app.${DD_SITE}` : `https://${DD_SITE ?? "datadoghq.com"}`;
    const logsLink = new URL(`/logs?query=${encodeURIComponent("app:starky")}`, appBase).toString();
    console.log("🔧 Starky ingest");
    console.log("• RPC:", STARKNET_RPC_URL);
    console.log("• Network:", STARKNET_NETWORK);
    console.log("• ABI File:", cfg.abiFile || "abi.json");
    console.log("• Event names from ABI:", eventNames.length);
    console.log("• Known event names:", eventMapper.getKnownEventNames().length);
    console.log("• Interval (ms):", argv["interval-ms"]);
    console.log("🔎 Logs Explorer:", logsLink);
  }

       const eventDict: { [key: string]: string } = {}; // nombre -> selector
       const eventSelectorDict: { [key: string]: string } = {}; // selector -> nombre
       const functionDict: { [key: string]: string } = {}; // nombre -> selector
       const functionSelectorDict: { [key: string]: string } = {}; // selector -> nombre

       if (abiParser) {
         const events = abiParser.getAllEvents();
         console.log(`📋 Processing ${events.length} events from ABI...`);

         for (const event of events) {
           try {
             const eventNameParts = event.name.split('::');
             const lastPart = eventNameParts[eventNameParts.length - 1];
             const cleanEventName = lastPart.replace(/Event$/, '');

             const eventSelector = event.selector;

             eventDict[cleanEventName] = eventSelector;
             eventSelectorDict[eventSelector] = cleanEventName;
           } catch (error) {
             console.warn(`⚠️  Could not generate selector for event: ${event.name}`, error);
           }
         }

         // Construir diccionario de funciones
         const functions = abiParser.getAllFunctions();
         console.log(`📋 Processing ${functions.length} functions from ABI...`);

         for (const func of functions) {
           try {
             // Para funciones, usar getSelectorFromName
             const functionSelector = hash.getSelectorFromName(func.name);

             functionDict[func.name] = functionSelector;
             functionSelectorDict[functionSelector] = func.name;
           } catch (error) {
             console.warn(`⚠️  Could not generate selector for function: ${func.name}`, error);
           }
         }
       }
  
       // Add events from manifest's global events section (only for Dojo)
       if (abiParser && abiParser.isLoaded() && abiParser.isDojoABI()) {
         const manifestEvents = abiParser.getManifestEvents();
         if (manifestEvents.length > 0) {
           console.log(`🔧 Adding ${manifestEvents.length} events from manifest...`);

           for (const event of manifestEvents) {
             try {
               // Use the tag as the event name and the selector directly
               const eventName = event.tag;
               const eventSelector = event.selector.toLowerCase();

               eventDict[eventName] = eventSelector;
               eventSelectorDict[eventSelector] = eventName;

               if (argv.verbose) {
                 console.log(`  📋 Manifest Event: ${eventName} -> ${eventSelector}`);
               }
             } catch (error) {
               console.warn(`  ⚠️ Failed to add manifest event ${event.tag}: ${error}`);
             }
           }
         }
       }

  console.log(`✅ Dictionaries built successfully!`);
  console.log(`  📝 Events: ${Object.keys(eventDict).length} entries`);
  console.log(`  🔧 Functions: ${Object.keys(functionDict).length} entries`);
  
  // Función helper para buscar eventos
  function getEventName(selector: string): string | undefined {
    return eventSelectorDict[selector];
  }
  
  function getEventSelector(name: string): string | undefined {
    return eventDict[name];
  }
  
  // Función helper para buscar funciones
  function getFunctionName(selector: string): string | undefined {
    return functionSelectorDict[selector];
  }
  
  function getFunctionSelector(name: string): string | undefined {
    return functionDict[name];
  }
  
  // Test de los diccionarios
  if (argv.verbose) {
    console.log("\n🧪 Testing dictionaries:");
    
    // Test eventos
    const testEventName = "Success"; // Nombre limpio
    const testEventSelector = getEventSelector(testEventName);
    if (testEventSelector) {
      const backToName = getEventName(testEventSelector);
      console.log(`  📝 Event test: ${testEventName} -> ${testEventSelector} -> ${backToName}`);
    }
    
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


  //
  while (true) {
    try {
      const addresses = contracts.length ? contracts : [undefined];
      let sent = 0, fetched = 0, functionCallsSent = 0;

      // Debug: show current block and what we're monitoring
      if (argv.verbose) {
        const currentBlock = await provider.getBlockNumber();
        console.log(`\n🔄 Block ${currentBlock} - monitoring ${contracts.length} contracts`);
        
        // Debug: check recent blocks for any transactions and process function calls
        try {
          const recentBlock = await provider.getBlockWithTxs(currentBlock);
          const txCount = recentBlock.transactions?.length || 0;
          
          // Debug: check for events in recent blocks without address filter
          try {
            const recentEvents = await provider.getEvents({
              from_block: { block_number: currentBlock },
              to_block: { block_number: currentBlock },
              chunk_size: 10
            } as any);
            const totalEvents = recentEvents.events?.length || 0;
            if (totalEvents > 0) {
              console.log(`📊 Block ${currentBlock}: ${txCount} txs, ${totalEvents} events`);
            }
          } catch (error) {
            // Silent fail
          }
          
          if (txCount > 0) {
            const allFunctionCalls: DDLog[] = [];
            
            recentBlock.transactions.slice(0, 5).forEach((tx: any, index: number) => {
              const txType = tx.type || "unknown";
              const txContract = tx.contract_address || tx.sender_address || "unknown";
              
              // Check if this transaction is to one of our monitored contracts
              const isMonitored = contracts.some(contract => 
                contract.toLowerCase() === txContract?.toLowerCase()
              );
              if (isMonitored) {
                // Extract function calls from this transaction
                const functionCalls = extractFunctionCalls(tx, functionSelectorDict, false);
                if (functionCalls.length > 0) {
                  console.log(`🔧 Function call: ${functionCalls.map(fc => fc.function_name).join(', ')}`);
                  
                  // Convert function calls to DDLog format
                  for (const call of functionCalls) {
                    allFunctionCalls.push({
                      message: "starknet_function_call",
                      service: "starky",
                      ddsource: "starknet",
                      ddtags: [
                        "app:starky",
                        "type:function_call",
                        `contract:${call.contract_address}`
                      ].filter(Boolean).join(","),
                      contract: call.contract_address,
                      type: "function_call",
                      function_name: call.function_name,
                      function_selector: call.function_selector,
                      tx_hash: call.tx_hash,
                      timestamp: call.timestamp,
                    });
                  }
                }
              } else {
                // Check if this transaction calls any of our monitored contracts in calldata
                const calldata = (tx as any).calldata || [];
                if (calldata.length > 1) {
                  const targetContract = calldata[1];
                  const isTargetMonitored = contracts.some(contract => 
                    contract.toLowerCase() === targetContract?.toLowerCase()
                  );
                  if (isTargetMonitored) {
                    // Extract function calls from this transaction
                    const functionCalls = extractFunctionCalls(tx, functionSelectorDict, false);
                    if (functionCalls.length > 0) {
                      console.log(`🔧 Function call: ${functionCalls.map(fc => fc.function_name).join(', ')}`);
                      
                      // Convert function calls to DDLog format
                      for (const call of functionCalls) {
                        allFunctionCalls.push({
                          message: "starknet_function_call",
                          service: "starky",
                          ddsource: "starknet",
                          ddtags: [
                            "app:starky",
                            "type:function_call",
                            `contract:${call.contract_address}`
                          ].filter(Boolean).join(","),
                          contract: call.contract_address,
                          type: "function_call",
                          function_name: call.function_name,
                          function_selector: call.function_selector,
                          tx_hash: call.tx_hash,
                          timestamp: call.timestamp,
                        });
                      }
                    }
                  }
                }
              }
            });
            
            // Send function calls to Datadog if any were found
            if (allFunctionCalls.length > 0) {
              await ddSendLogs(allFunctionCalls, { verbose: false, preview: 0, dumpFile: argv.dump as string | undefined });
              functionCallsSent += allFunctionCalls.length;
            }
          }
        } catch (error) {
          console.log(`⚠️  Could not fetch recent block: ${error}`);
        }
      }

      // We'll get function calls from events after we fetch them

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
          
          // Debug: always show what we're looking for and what we found
          if (argv.verbose && events.length > 0) {
            const label = addr ? addr.slice(0, 10) + "…" : "(no address filter)";
            console.log(`📝 Found ${events.length} events from ${label}`);
          }


          // Get function calls from these events
          if (contracts.length > 0 && events.length > 0) {
            const functionCallLogs = await getFunctionCallsFromEvents(
              provider, 
              events, 
              contracts, 
              functionSelectorDict, 
              argv.verbose
            );
            
            if (functionCallLogs.length > 0) {
              await ddSendLogs(functionCallLogs, { verbose: false, preview: 0, dumpFile: argv.dump as string | undefined });
              functionCallsSent += functionCallLogs.length;
            }
          }

          const logs: DDLog[] = [];
          for (let i = 0; i < events.length; i++) {
            const e = events[i];

            const sel = (e.keys?.[0] ?? "").toLowerCase();
            const tags = [
              "app:starky",
              "type:event",
              `network:${STARKNET_NETWORK}`,
              e.from_address ? `contract:${e.from_address}` : undefined
            ].filter(Boolean).join(",");

            // Usar diccionario para obtener nombre del evento
            const eventSelector = e.keys?.[0] || "";
            const eventName = getEventName(eventSelector) || eventSelector;
            
            
            logs.push({
              message: "starknet_event",
              service: "starky",
              ddsource: "starknet",
              ddtags: tags,
              contract: e.from_address,
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
            await ddSendLogs(logs, { verbose: false, preview: 0, dumpFile: argv.dump as string | undefined });
            sent += logs.length;
          }
        } while (cont);
      }

      if (argv.verbose) {
        if (functionCallsSent > 0 || sent > 0) {
          console.log(`📈 Sent: ${functionCallsSent} function calls, ${sent} events`);
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
