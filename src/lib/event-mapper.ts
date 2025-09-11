import { hash } from "starknet";
import { ABIParser, EventInfo } from "./abi-parser.js";

/**
 * Maps event selectors to event names using ABI data
 */
export class EventMapper {
  private selectorToName: Map<string, string> = new Map();
  private selectorToEvent: Map<string, EventInfo> = new Map();
  private abiParser?: ABIParser;

  constructor(abiParser?: ABIParser) {
    this.abiParser = abiParser;
    if (abiParser) {
      this.loadEventsFromABI();
    }
  }

  /**
   * Load events from ABI parser
   */
  private loadEventsFromABI(): void {
    if (!this.abiParser) return;

    const events = this.abiParser.getAllEvents();
    
    for (const event of events) {
      this.selectorToName.set(event.selector, event.name);
      this.selectorToEvent.set(event.selector, event);
    }
    
    console.log(`✅ Loaded ${events.length} events from ABI`);
  }

  /**
   * Load events from ABI file
   */
  async loadEventsFromABIFile(abiFile: string): Promise<void> {
    this.abiParser = new ABIParser(abiFile);
    await this.abiParser.loadABI();
    this.loadEventsFromABI();
  }

  /**
   * Load events from contracts automatically (legacy method)
   */
  async loadEventsFromContracts(contractAddresses: string[]): Promise<void> {
    if (!this.abiParser) {
      console.warn("ABI Parser not available for auto-loading events");
      return;
    }

    console.log(`🔄 Auto-loading events for ${contractAddresses.length} contracts...`);
    
    for (const address of contractAddresses) {
      const contract = this.abiParser.getContract(address);
      if (contract) {
        for (const event of contract.events) {
          this.selectorToName.set(event.selector, event.name);
          this.selectorToEvent.set(event.selector, event);
        }
      }
    }
    
    console.log(`✅ Loaded ${this.selectorToName.size} unique event mappings`);
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
    
    // First try to get from global map
    const globalName = this.selectorToName.get(normalizedSelector);
    if (globalName) return globalName;
    
    // If not found globally, try to find in specific contract
    if (this.abiParser) {
      const contract = this.abiParser.getContract(contractAddress);
      if (contract) {
        for (const event of contract.events) {
          if (event.selector === normalizedSelector) {
            return event.name;
          }
        }
      }
    }
    
    return selector;
  }

  /**
   * Get event info from selector
   */
  getEventInfo(selector: string): EventInfo | undefined {
    if (!selector) return undefined;
    
    const normalizedSelector = selector.toLowerCase();
    return this.selectorToEvent.get(normalizedSelector);
  }

  /**
   * Get all known event names
   */
  getKnownEventNames(): string[] {
    return Array.from(this.selectorToName.values());
  }

  /**
   * Get all known event selectors
   */
  getKnownEventSelectors(): string[] {
    return Array.from(this.selectorToName.keys());
  }

  /**
   * Check if selector is known
   */
  isKnownSelector(selector: string): boolean {
    return this.selectorToName.has(selector.toLowerCase());
  }

  /**
   * Get events by contract address
   */
  getEventsByContract(contractAddress: string): EventInfo[] {
    if (!this.abiParser) return [];
    
    const contract = this.abiParser.getContract(contractAddress);
    return contract ? contract.events : [];
  }

  /**
   * Get all events from ABI
   */
  getAllEvents(): EventInfo[] {
    if (!this.abiParser) return [];
    return this.abiParser.getAllEvents();
  }
}
