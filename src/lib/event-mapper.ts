import { hash } from "starknet";
import { ContractABI, ManualEventMapping } from "./config.js";
import { ABIFetcher } from "./abi-fetcher.js";

/**
 * Maps event selectors to event names using contract ABIs
 */
export class EventMapper {
  private selectorToName: Map<string, string> = new Map();
  private contractToABI: Map<string, any[]> = new Map();
  private abiFetcher?: ABIFetcher;
  private autoFetchEnabled: boolean = false;

  constructor(contractABIs: ContractABI[] = [], abiFetcher?: ABIFetcher, manualMappings: ManualEventMapping[] = []) {
    this.abiFetcher = abiFetcher;
    this.loadABIs(contractABIs);
    this.loadManualMappings(manualMappings);
  }

  /**
   * Enable automatic ABI fetching for contracts
   */
  enableAutoFetch(abiFetcher: ABIFetcher) {
    this.abiFetcher = abiFetcher;
    this.autoFetchEnabled = true;
  }

  /**
   * Load events from contracts automatically
   */
  async loadEventsFromContracts(contractAddresses: string[]): Promise<void> {
    if (!this.abiFetcher) {
      console.warn("ABIFetcher not available for auto-loading events");
      return;
    }

    console.log(`🔄 Auto-loading events for ${contractAddresses.length} contracts...`);
    const eventsMap = await this.abiFetcher.getEventsForContracts(contractAddresses);
    
    for (const [address, events] of eventsMap) {
      for (const event of events) {
        this.selectorToName.set(event.selector, event.name);
      }
    }
    
    console.log(`✅ Loaded ${this.selectorToName.size} unique event mappings`);
  }

  private loadABIs(contractABIs: ContractABI[]) {
    for (const contractABI of contractABIs) {
      const address = contractABI.address.toLowerCase();
      this.contractToABI.set(address, contractABI.abi);
      
      // Extract events from ABI
      if (contractABI.abi && Array.isArray(contractABI.abi)) {
        for (const item of contractABI.abi) {
          if (item.type === "event" && item.name) {
            try {
              const selector = hash.getSelectorFromName(item.name).toLowerCase();
              this.selectorToName.set(selector, item.name);
            } catch (error) {
              console.warn(`Failed to get selector for event ${item.name}:`, error);
            }
          }
        }
      }
    }
  }

  private loadManualMappings(manualMappings: ManualEventMapping[]) {
    for (const mapping of manualMappings) {
      const normalizedSelector = mapping.selector.toLowerCase();
      this.selectorToName.set(normalizedSelector, mapping.name);
    }
  }

  /**
   * Get event name from selector
   */
  getEventName(selector: string): string {
    if (!selector) return "unknown";
    
    const normalizedSelector = selector.toLowerCase();
    return this.selectorToName.get(normalizedSelector) || selector;
  }

  /**
   * Get event name from selector with contract context
   */
  getEventNameWithContext(selector: string, contractAddress: string): string {
    if (!selector) return "unknown";
    
    const normalizedSelector = selector.toLowerCase();
    const normalizedAddress = contractAddress?.toLowerCase();
    
    // First try to get from global map
    const globalName = this.selectorToName.get(normalizedSelector);
    if (globalName) return globalName;
    
    // If not found globally, try to find in specific contract ABI
    if (normalizedAddress && this.contractToABI.has(normalizedAddress)) {
      const abi = this.contractToABI.get(normalizedAddress);
      if (abi) {
        for (const item of abi) {
          if (item.type === "event" && item.name) {
            try {
              const itemSelector = hash.getSelectorFromName(item.name).toLowerCase();
              if (itemSelector === normalizedSelector) {
                return item.name;
              }
            } catch (error) {
              // Ignore errors for individual items
            }
          }
        }
      }
    }
    
    return selector;
  }

  /**
   * Get all known event names
   */
  getKnownEventNames(): string[] {
    return Array.from(this.selectorToName.values());
  }

  /**
   * Check if selector is known
   */
  isKnownSelector(selector: string): boolean {
    return this.selectorToName.has(selector.toLowerCase());
  }
}
