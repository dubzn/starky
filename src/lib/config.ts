import fs from "fs";
import path from "path";

export type StarkyConfig = {
  activeBoardId?: string;
  contracts: string[];
  eventNames?: string[];
};

const CONFIG_FILE = path.resolve(process.cwd(), "starky.config.json");

export function loadConfig(): StarkyConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { contracts: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return {
      activeBoardId: raw.activeBoardId,
      contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
      eventNames: Array.isArray(raw.eventNames) ? raw.eventNames : []
    };
  } catch {
    return { contracts: [] };
  }
}

export function saveConfig(cfg: StarkyConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function setActiveBoard(boardId: string) {
  const cfg = loadConfig();
  cfg.activeBoardId = boardId;
  saveConfig(cfg);
}
