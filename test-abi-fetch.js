#!/usr/bin/env node

/**
 * Test script for ABI fetching and event mapping
 * Run with: node test-abi-fetch.js
 */

import { makeProvider } from "./dist/lib/starknet.js";
import { ABIFetcher } from "./dist/lib/abi-fetcher.js";
import { EventMapper } from "./dist/lib/event-mapper.js";

async function testABIFetching() {
  console.log("🧪 Testing ABI fetching and event mapping...\n");
  
  try {
    // Initialize provider
    const provider = makeProvider();
    const abiFetcher = new ABIFetcher(provider);
    const eventMapper = new EventMapper([], abiFetcher);
    
    // Test contracts (you can modify these)
    const testContracts = [
      "0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b"
    ];
    
    console.log("📋 Testing contracts:");
    testContracts.forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr}`);
    });
    console.log();
    
    // Test individual ABI fetching
    console.log("🔍 Testing individual ABI fetching:");
    for (const contract of testContracts) {
      const abi = await abiFetcher.getContractABI(contract);
      const events = abiFetcher.extractEventsFromABI(abi);
      
      console.log(`\n📄 Contract: ${contract.slice(0, 10)}...`);
      console.log(`   ABI items: ${abi.length}`);
      console.log(`   Events found: ${events.length}`);
      
      if (events.length > 0) {
        console.log("   Event names:");
        events.forEach(event => {
          console.log(`     - ${event.name} (${event.selector})`);
        });
      }
    }
    
    // Test event mapper
    console.log("\n🔄 Testing event mapper:");
    await eventMapper.loadEventsFromContracts(testContracts);
    
    // Test event name resolution with real selectors from Ekubo
    console.log("\n🎯 Testing event name resolution:");
    const testSelectors = [
      "0x96982abd597114bdaa4a60612f87fabfcc7206aa12d61c50e7ba1e6c291100",
      "0x157717768aca88da4ac4279765f09f4d0151823d573537fbbeb950cdbd9a870",
      "0x3a7adca3546c213ce791fabf3b04090c163e419c808c9830fb343a4a395946e",
      "0x2271296ce6363424ad00b139f475fb44986402201092867a8bee0cff6e2f223", // Swapped
      "0x354c2630060a9ac1ae3e43937744518643165649592ebcd1cc2182ad512fdad", // SavedBalance
      "0x33f3d2b1c2e58f2d672421958619bd294df0669165c095ec23a59a616dcd9f"  // LoadedBalance
    ];
    
    for (const selector of testSelectors) {
      const eventName = eventMapper.getEventName(selector);
      console.log(`   ${selector.slice(0, 20)}... → "${eventName}"`);
    }
    
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testABIFetching();
