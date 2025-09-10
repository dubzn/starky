import { ddCreateDashboard } from "../lib/datadog.js";
import { loadConfig, saveConfig, setActiveBoard } from "../lib/config.js";

export const command = "board";
export const describe = "Manage Datadog dashboards";

/**
 * Generate simple widgets for event monitoring
 */
function generateSimpleWidgets(): any[] {
  return [];
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
                    content: "![Alt text](https://i.ibb.co/4g3HJNLW/image.png)",
                    background_color: "transparent",
                    font_size: "12",
                    text_align: "left",
                    vertical_align: "top",
                    show_tick: false,
                    tick_pos: "50%",
                    tick_edge: "left",
                    has_padding: false
                  }
                },
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
              title: "Contract calls",
              background_color: "vivid_blue",
              show_title: true,
              type: "group",
              layout_type: "ordered",
              widgets: [
                {
                  definition: {
                    title: "Total Function Calls",
                    time: {},
                    type: "query_value",
                    requests: [
                        {
                            formulas: [
                                {
                                    formula: "default_zero(query1)",
                                    number_format: {
                                        unit: {
                                            type: "custom_unit_label",
                                            label: "Calls"
                                        }
                                    }
                                }
                            ],
                            response_format: "scalar",
                            queries: [
                                {
                                    search: {
                                        query: "app:starky AND type:function_call"
                                    },
                                    data_source: "logs",
                                    compute: {
                                        aggregation: "count"
                                    },
                                    name: "query1",
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: []
                                }
                            ]
                        }
                    ],
                    autoscale: false,
                    text_align: "center",
                    custom_links: [],
                    precision: 0
                  }
                },
                {
                  definition: {
                    title: "Function calls count over time",
                    show_legend: true,
                    legend_layout: "auto",
                    legend_columns: ["avg","min","max","value","sum"],
                    time: {},
                    type: "timeseries",
                    requests: [
                        {
                            formulas: [
                                {
                                    formula: "default_zero(query1)",
                                    number_format: {
                                        unit: {
                                            type: "custom_unit_label",
                                            label: "Calls"
                                        }
                                    }
                                }
                            ],
                            queries: [
                                {
                                    search: {
                                        query: "app:starky AND type:function_call"
                                    },
                                    data_source: "logs",
                                    compute: {
                                        aggregation: "count"
                                    },
                                    name: "query1",
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: []
                                }
                            ],
                            response_format: "timeseries",
                            style: {
                                palette: "dog_classic",
                                order_by: "values",
                                line_type: "solid",
                                line_width: "normal"
                            },
                            display_type: "line"
                        }
                    ]
                  }
                },
                {
                  definition: {
                    title: "Top function calls",
                    type: "toplist",
                    requests: [
                        {
                            response_format: "scalar",
                            queries: [
                                {
                                    name: "q1",
                                    data_source: "logs",
                                    search: {
                                        query: "app:starky AND type:function_call"
                                    },
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: [
                                        {
                                            facet: "@function_name",
                                            limit: 20,
                                            sort: {
                                                aggregation: "count",
                                                order: "desc",
                                                metric: "count"
                                            },
                                            should_exclude_missing: true
                                        }
                                    ],
                                    compute: {
                                        aggregation: "count"
                                    },
                                    storage: "hot"
                                }
                            ],
                            formulas: [
                                {
                                    formula: "q1"
                                }
                            ],
                            sort: {
                                count: 25,
                                order_by: [
                                    {
                                        type: "formula",
                                        index: 0,
                                        order: "desc"
                                    }
                                ]
                            }
                        }
                    ],
                    style: {
                        scaling: "absolute"
                    }
                  }
                }
              ]
            }
          },
          {
            definition: {
              title: "Events",
              background_color: "vivid_purple",
              show_title: true,
              type: "group",
              layout_type: "ordered",
              widgets: [
                {
                  definition: {
                    title: "Total Events",
                    time: {},
                    type: "query_value",
                    requests: [
                        {
                            formulas: [
                                {
                                    formula: "default_zero(query1)",
                                    number_format: {
                                        unit: {
                                            type: "custom_unit_label",
                                            label: "Events"
                                        }
                                    }
                                }
                            ],
                            response_format: "scalar",
                            queries: [
                                {
                                    search: {
                                        query: "app:starky"
                                    },
                                    data_source: "logs",
                                    compute: {
                                        aggregation: "count"
                                    },
                                    name: "query1",
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: []
                                }
                            ]
                        }
                    ],
                    autoscale: false,
                    text_align: "center",
                    custom_links: [],
                    precision: 0
                  }
                },
                {
                  definition: {
                    title: "Events count over time",
                    show_legend: true,
                    legend_layout: "auto",
                    legend_columns: ["avg","min","max","value","sum"],
                    time: {},
                    type: "timeseries",
                    requests: [
                        {
                            formulas: [
                                {
                                    formula: "default_zero(query1)",
                                    number_format: {
                                        unit: {
                                            type: "custom_unit_label",
                                            label: "Events"
                                        }
                                    }
                                }
                            ],
                            queries: [
                                {
                                    search: {
                                        query: "app:starky"
                                    },
                                    data_source: "logs",
                                    compute: {
                                        aggregation: "count"
                                    },
                                    name: "query1",
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: []
                                }
                            ],
                            response_format: "timeseries",
                            style: {
                                palette: "dog_classic",
                                order_by: "values",
                                line_type: "solid",
                                line_width: "normal"
                            },
                            display_type: "line"
                        }
                    ]
                  }
                },
                {
                  definition: {
                    title: "Top events",
                    type: "toplist",
                    requests: [
                        {
                            response_format: "scalar",
                            queries: [
                                {
                                    name: "q1",
                                    data_source: "logs",
                                    search: {
                                        query: "app:starky"
                                    },
                                    indexes: [
                                        "*"
                                    ],
                                    group_by: [
                                        {
                                            facet: "@event_name",
                                            limit: 20,
                                            sort: {
                                                aggregation: "count",
                                                order: "desc",
                                                metric: "count"
                                            },
                                            should_exclude_missing: true
                                        }
                                    ],
                                    compute: {
                                        aggregation: "count"
                                    },
                                    storage: "hot"
                                }
                            ],
                            formulas: [
                                {
                                    formula: "q1"
                                }
                            ],
                            sort: {
                                count: 25,
                                order_by: [
                                    {
                                        type: "formula",
                                        index: 0,
                                        order: "desc"
                                    }
                                ]
                            }
                        }
                    ],
                    style: {
                        scaling: "absolute"
                    }
                  }
                }
              ]
            }
          }
        ];
        
        // Generate simple event widgets
        console.log("🔄 Generating simple event widgets...");
        const simpleWidgets = generateSimpleWidgets();
        
        // Combine all widgets
        const allWidgets = [...baseWidgets, ...simpleWidgets];
        
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
        console.log(`📊 Generated ${allWidgets.length} widgets (${baseWidgets.length} base + ${simpleWidgets.length} simple)`);
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
