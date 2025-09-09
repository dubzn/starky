import { ddCreateDashboard } from "../lib/datadog.js";
import { loadConfig, saveConfig, setActiveBoard } from "../lib/config.js";
import { EventMapper } from "../lib/event-mapper.js";
import { ABIFetcher } from "../lib/abi-fetcher.js";
import { RpcProvider } from "starknet";

export const command = "board";
export const describe = "Manage Datadog dashboards";

/**
 * Generate dynamic widgets based on known events from contracts
 */
async function generateEventWidgets(contracts: string[]): Promise<any[]> {
  const widgets: any[] = [];
  
  if (contracts.length === 0) {
    return widgets;
  }

  try {
    // Initialize event mapper to get known events
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL || "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/ZM5uRejFu-dUlLSZ2fXhg" });
    const abiFetcher = new ABIFetcher(provider);
    const cfg = loadConfig();
    const eventMapper = new EventMapper(cfg.contractABIs, abiFetcher, cfg.manualEventMappings);
    
    // Load events from contracts
    await eventMapper.loadEventsFromContracts(contracts);
    const knownEvents = eventMapper.getKnownEventNames();
    
    console.log(`📋 Found ${knownEvents.length} known events across ${contracts.length} contracts`);
    
    // Group events by contract for better organization
    const eventsByContract = new Map<string, string[]>();
    
    // For now, we'll create widgets for the most common events we know about
    const commonEvents = [
      'PositionUpdated',
      'PositionFeesCollected', 
      'PoolInitialized',
      'ProtocolFeesPaid',
      'Swapped',
      'SavedBalance',
      'LoadedBalance',
      'FeesAccumulated'
    ];
    
    // Filter to only include events that are actually in our known events
    const availableEvents = commonEvents.filter(event => 
      knownEvents.some(known => known.includes(event) || known === event)
    );
    
    for (const contract of contracts) {
      eventsByContract.set(contract, availableEvents);
    }
    
    // Create widgets for each contract's events
    for (const [contract, events] of eventsByContract) {
      const contractShort = contract.slice(0, 10) + "...";
      
      // Create event widgets for this contract
      const contractEventWidgets = [];
      for (const eventName of events.slice(0, 3)) { // Limit to 3 events per contract
        contractEventWidgets.push({
          definition: {
            type: "log_stream",
            title: `${eventName} Events`,
            query: `app:starky AND event_name:${eventName}`,
            indexes: ["*"],
            columns: ["timestamp", "event_name", "contract_address", "tx_hash"],
            sort: {
              column: "timestamp",
              order: "desc"
            }
          }
        });
      }
      
      // Add group for this contract
      widgets.push({
        definition: {
          title: `Contract ${contractShort}`,
          background_color: "vivid_pink",
          show_title: true,
          type: "group",
          layout_type: "ordered",
          widgets: contractEventWidgets
        }
      });
    }
    
    // Add group for unknown events
    widgets.push({
      definition: {
        title: "Unknown Events (by Selector)",
        background_color: "vivid_orange",
        show_title: true,
        type: "group",
        layout_type: "ordered",
        widgets: [
          {
            definition: {
              type: "log_stream",
              title: "Unknown Events - Grouped by Selector",
              query: "app:starky AND event_selector:*",
              indexes: ["*"],
              columns: ["timestamp", "event_selector", "contract_address", "tx_hash"],
              sort: {
                column: "timestamp",
                order: "desc"
              }
            }
          }
        ]
      }
    });
    
  } catch (error) {
    console.warn("⚠️ Could not generate dynamic widgets:", error);
  }
  
  return widgets;
}

export const builder = (y: any) =>
  y
    .command(
      "create <name>",
      "Create a Datadog dashboard and set it as active",
      (yy: any) => yy.positional("name", { type: "string", demandOption: true }),
      async (argv: any) => {
        const cfg = loadConfig();
        const contracts = cfg.contracts || [];
        
        // Generate base widgets with hero image
        const baseWidgets = [
          {
            definition: {
              title: "Starky Events Dashboard",
              banner_img: "https://images.lumacdn.com/calendar-cover-images/ia/63c49efe-f39d-41dc-86d6-56f57ed39834",
              show_title: false,
              type: "group",
              layout_type: "ordered",
              widgets: [
                {
                  definition: {
                    type: "note",
                    content: "# Real-time blockchain event monitoring with automatic event name mapping",
                    background_color: "transparent",
                    font_size: "18",
                    text_align: "left",
                    vertical_align: "center",
                    show_tick: false,
                    tick_pos: "50%",
                    tick_edge: "left",
                    has_padding: true
                  }
                },
                {
                  definition: {
                    type: "note",
                    content: "## Learn more about Starky\n\n[GitHub Repository ↗](https://github.com/dubzn/starky)\n| [Documentation ↗](https://docs.starky.com/) | [Configuration ↗](https://app.datadoghq.com/organization-settings/)\n\nTip: Clone this dashboard to rearrange, modify, and add visualizations.\n\n*Empty dashboard?* Check your Starky configuration and ensure events are being ingested.",
                    background_color: "transparent",
                    font_size: "14",
                    text_align: "left",
                    vertical_align: "center",
                    show_tick: false,
                    tick_pos: "50%",
                    tick_edge: "left",
                    has_padding: true
                  }
                }
              ]
            }
          },
          {
            definition: {
              title: "Overview",
              background_color: "white",
              show_title: true,
              type: "group",
              layout_type: "ordered",
              widgets: [
                {
                  definition: {
                    "title": "Total Events",
                    "type": "query_value",
                    "requests": [
                        {
                            "formulas": [
                                {
                                    "formula": "default_zero(query1)",
                                    "number_format": {
                                        "unit": {
                                            "type": "custom_unit_label",
                                            "label": "Events"
                                        }
                                    }
                                }
                            ],
                            "response_format": "scalar",
                            "queries": [
                                {
                                    "search": {
                                        "query": "app:starky"
                                    },
                                    "data_source": "logs",
                                    "compute": {
                                        "aggregation": "count"
                                    },
                                    "name": "query1",
                                    "indexes": [
                                        "*"
                                    ],
                                    "group_by": []
                                }
                            ]
                        }
                    ],
                    "autoscale": false,
                    "text_align": "center",
                    "custom_links": [],
                    "precision": 0,
                    "timeseries_background": {
                        "type": "area",
                        "yaxis": {
                            "include_zero": true
                        }
                    }
                }
                },
              ]
            }
          }
        ];
        
        // Generate dynamic event widgets
        console.log("🔄 Generating dynamic widgets based on contract ABIs...");
        const dynamicWidgets = await generateEventWidgets(contracts);
        
        // Combine all widgets
        const allWidgets = [...baseWidgets, ...dynamicWidgets];
        
        const template = {
          title: argv.name,
          layout_type: "ordered",
          template_variables: [
            { name: "contract", prefix: "contract", default: "*" }
          ],
          widgets: allWidgets
        };

        const res = await ddCreateDashboard(template);
        setActiveBoard(res.id);
        console.log(`✅ Dashboard created`);
        console.log(`id: ${res.id}`);
        console.log(`url: ${res.fullUrl}`);
        console.log(`📌 Active board set in starky.config.json`);
        console.log(`📊 Generated ${allWidgets.length} widgets (${baseWidgets.length} base + ${dynamicWidgets.length} dynamic)`);
      }
    )
    .command(
      "use <boardId>",
      "Set the active board id",
      (yy: any) => yy.positional("boardId", { type: "string", demandOption: true }),
      async (argv: any) => {
        setActiveBoard(argv.boardId);
        console.log(`📌 Active board: ${argv.boardId}`);
      }
    )
    .command(
      "info",
      "Show active board and current config",
      () => {},
      async () => {
        const cfg = loadConfig();
        console.log(JSON.stringify(cfg, null, 2));
      }
    );

export const handler = () => {};
