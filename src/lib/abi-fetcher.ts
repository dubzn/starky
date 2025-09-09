import { RpcProvider, hash } from "starknet";

/**
 * Fetches contract ABI automatically from Starknet
 */
export class ABIFetcher {
  private provider: RpcProvider;
  private cache: Map<string, readonly any[]> = new Map();

  constructor(provider: RpcProvider) {
    this.provider = provider;
  }

  /**
   * Get contract class and extract ABI
   */
  async getContractABI(contractAddress: string): Promise<readonly any[]> {
    const normalizedAddress = contractAddress.toLowerCase();
    
    // Check cache first
    if (this.cache.has(normalizedAddress)) {
      return this.cache.get(normalizedAddress)!;
    }

    try {
      console.log(`🔍 Fetching ABI for contract: ${contractAddress.slice(0, 10)}...`);
      
      // Get contract class
      const contractClass = await this.provider.getClassAt(contractAddress);
      
      if (!contractClass || !contractClass.abi) {
        console.warn(`⚠️  No ABI found for contract: ${contractAddress}`);
        return [];
      }

      const abi = contractClass.abi;
      console.log(`✅ ABI loaded: ${abi.length} items for contract ${contractAddress.slice(0, 10)}...`);
      
      // Cache the result
      this.cache.set(normalizedAddress, abi);
      
      return abi;
    } catch (error) {
      console.error(`❌ Failed to fetch ABI for ${contractAddress}:`, error);
      return [];
    }
  }

  /**
   * Get all events from ABI
   */
  extractEventsFromABI(abi: readonly any[]): Array<{name: string, selector: string}> {
    const events: Array<{name: string, selector: string}> = [];
    
    for (const item of abi) {
      if (item.type === "event" && item.name) {
        try {
          // Calculate selector using Starknet's hash function
          const selector = this.calculateEventSelector(item.name);
          events.push({
            name: item.name,
            selector: selector
          });
        } catch (error) {
          console.warn(`Failed to calculate selector for event ${item.name}:`, error);
        }
      }
    }
    
    return events;
  }

  /**
   * Calculate event selector using Starknet's keccak hash
   */
  private calculateEventSelector(eventName: string): string {
    return hash.getSelectorFromName(eventName).toLowerCase();
  }

  /**
   * Get events for multiple contracts
   */
  async getEventsForContracts(contractAddresses: string[]): Promise<Map<string, Array<{name: string, selector: string}>>> {
    const result = new Map<string, Array<{name: string, selector: string}>>();
    
    for (const address of contractAddresses) {
      const abi = await this.getContractABI(address);
      const events = this.extractEventsFromABI(abi);
      result.set(address.toLowerCase(), events);
      
      if (events.length > 0) {
        console.log(`📋 Events found for ${address.slice(0, 10)}...:`, events.map(e => e.name));
      }
    }
    
    return result;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
