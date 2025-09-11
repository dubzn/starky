import fs from "fs";
import path from "path";
import { ABIParser, ContractInfo } from "./abi-parser.js";

export type StarkyConfig = {
  activeBoardId?: string;
  abiFile?: string;
  // Legacy fields for backward compatibility
  contracts?: string[];
  eventNames?: string[];
};

const CONFIG_FILE = path.resolve(process.cwd(), "starky.config.json");
const DEFAULT_ABI_FILE = "abi.json";

export function loadConfig(): StarkyConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { abiFile: DEFAULT_ABI_FILE };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return {
      activeBoardId: raw.activeBoardId,
      abiFile: raw.abiFile || DEFAULT_ABI_FILE,
      // Legacy fields
      contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
      eventNames: Array.isArray(raw.eventNames) ? raw.eventNames : []
    };
  } catch {
    return { abiFile: DEFAULT_ABI_FILE };
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

/**
 * Load contracts and events from ABI file
 */
export async function loadContractsFromABI(abiFile?: string): Promise<{
  contracts: ContractInfo[];
  contractAddresses: string[];
  eventNames: string[];
}> {
  const parser = new ABIParser(abiFile || DEFAULT_ABI_FILE);
  await parser.loadABI();
  
  const contracts = parser.getContracts();
  
  // Para contract classes, solo incluir contratos con direcciones válidas
  const contractAddresses = contracts
    .filter(contract => contract.address !== "unknown")
    .map(contract => contract.address);
    
  const eventNames = parser.getAllEvents().map(event => event.name);
  
  return {
    contracts,
    contractAddresses,
    eventNames
  };
}

/**
 * Get contract info by address
 */
export async function getContractInfo(address: string, abiFile?: string): Promise<ContractInfo | undefined> {
  const parser = new ABIParser(abiFile || DEFAULT_ABI_FILE);
  await parser.loadABI();
  return parser.getContract(address);
}
