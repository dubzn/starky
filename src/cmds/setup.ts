import { loadConfig, saveConfig } from "../lib/config.js";
import { ABIParser } from "../lib/abi-parser.js";

export const command = "setup";
export const describe = "Setup contracts from ABI file";

export const builder = (y: any) =>
  y
    .option("abi-file", { 
      type: "string", 
      desc: "Path to ABI file (abi.json for Dojo, *.contract_class.json for Scarb)",
      demandOption: true 
    })
    .option("force", { 
      type: "boolean", 
      default: false, 
      desc: "Force update even if contracts already exist" 
    });

export const handler = async (argv: any) => {
  try {
    console.log("🔧 Setting up contracts from ABI file...");
    console.log(`📁 ABI File: ${argv["abi-file"]}`);

    // Load current config
    const cfg = loadConfig();
    
    // Check if contracts already exist and force is not set
    if (cfg.contracts && cfg.contracts.length > 0 && !argv.force) {
      console.log(`⚠️  Contracts already configured: ${cfg.contracts.length} contracts`);
      console.log(`   Use --force to overwrite existing configuration`);
      console.log(`   Current contracts:`, cfg.contracts);
      return;
    }

    // Initialize ABI parser
    const parser = new ABIParser(argv["abi-file"]);
    await parser.loadABI();

    // Get contract addresses
    const contractAddresses = parser.getContractAddresses();
    
    if (contractAddresses.length === 0) {
      console.log(`ℹ️  No deployed contracts found in ABI file`);
      console.log(`   This appears to be a contract class (Scarb) - no action needed`);
      console.log(`   Contract classes require manual configuration of deployed addresses`);
      console.log(`   Example: "contracts": ["0x123...", "0x456..."]`);
      return;
    }

    // Update config with contract addresses
    cfg.contracts = contractAddresses;
    cfg.abiFile = argv["abi-file"];
    
    // Save updated config
    saveConfig(cfg);
    
    console.log(`✅ Configuration updated successfully!`);
    console.log(`📋 Contracts configured: ${contractAddresses.length}`);
    for (const address of contractAddresses) {
      console.log(`   • ${address}`);
    }
    console.log(`📁 ABI File: ${cfg.abiFile}`);
    console.log(`🎯 Ready to run: ./bin/starky.js ingest`);

  } catch (error) {
    console.error(`❌ Setup failed:`, error);
    process.exit(1);
  }
};

