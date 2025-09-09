import { ddCreateDashboard } from "../lib/datadog.js";
import { loadConfig, saveConfig, setActiveBoard } from "../lib/config.js";

export const command = "board";
export const describe = "Manage Datadog dashboards";

export const builder = (y: any) =>
  y
    .command(
      "create <name>",
      "Create a Datadog dashboard and set it as active",
      (yy: any) => yy.positional("name", { type: "string", demandOption: true }),
      async (argv: any) => {
        const template = {
          title: argv.name,
          layout_type: "ordered",
          template_variables: [
            { name: "contract", prefix: "contract", default: "*" }
          ],
          widgets: [
            {
              definition: {
                type: "timeseries",
                title: "Event count over time",
                requests: [
                  {
                    response_format: "timeseries",
                    display_type: "line",
                    queries: [
                      {
                        data_source: "logs",
                        name: "q1",
                        search: { query: "app:starky" },
                        indexes: ["*"],
                        compute: { aggregation: "count" }
                      }
                    ],
                    formulas: [{ formula: "q1" }]
                  }
                ]
              }
            },
            {
              definition: {
                type: "toplist",
                title: "Top contracts by events",
                requests: [
                  {
                    response_format: "scalar",
                    queries: [
                      {
                        data_source: "logs",
                        name: "q1",
                        search: { query: "app:starky" },
                        indexes: ["*"],
                        compute: { aggregation: "count" },
                        group_by: [
                          {
                            facet: "tag:contract",
                            limit: 10,
                            sort: { aggregation: "count", order: "desc" }
                          }
                        ]
                      }
                    ],
                    formulas: [{ formula: "q1" }]
                  }
                ]
              }
            },
            {
              definition: {
                type: "log_stream",
                title: "Recent events for contract:$contract",
                query: "app:starky AND contract:$contract",
                indexes: ["*"]
              }
            }
          ]
        };

        const res = await ddCreateDashboard(template);
        setActiveBoard(res.id);
        console.log(`✅ Dashboard created`);
        console.log(`id: ${res.id}`);
        console.log(`url: ${res.fullUrl}`);
        console.log(`📌 Active board set in starky.config.json`);
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
