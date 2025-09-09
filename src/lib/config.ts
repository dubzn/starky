import fs from "fs";
import path from "path";

export type ContractABI = {
  address: string;
  abi: any[];
};

export type ManualEventMapping = {
  selector: string;
  name: string;
};

export type StarkyConfig = {
  activeBoardId?: string;
  contracts: string[];
  excludeEventNames: string[];
  contractABIs?: ContractABI[];
  manualEventMappings?: ManualEventMapping[];
};

const CONFIG_FILE = path.resolve(process.cwd(), "starky.config.json");

export function loadConfig(): StarkyConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { contracts: [], excludeEventNames: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return {
      activeBoardId: raw.activeBoardId,
      contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
      excludeEventNames: Array.isArray(raw.excludeEventNames) ? raw.excludeEventNames : [],
      contractABIs: Array.isArray(raw.contractABIs) ? raw.contractABIs : [],
      manualEventMappings: Array.isArray(raw.manualEventMappings) ? raw.manualEventMappings : []
    };
  } catch {
    return { contracts: [], excludeEventNames: [] };
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
