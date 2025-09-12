import fs from "fs";
import path from "path";
import { hash } from "starknet";

export interface ContractInfo {
  address: string;
  classHash: string;
  name: string;
  kind: string;
  events: EventInfo[];
  functions: FunctionInfo[];
}

export interface EventInfo {
  name: string;
  selector: string;
  inputs: Array<{
    name: string;
    type: string;
  }>;
}

export interface FunctionInfo {
  name: string;
  selector: string;
  inputs: Array<{
    name: string;
    type: string;
  }>;
  outputs: Array<{
    type: string;
  }>;
  stateMutability: string;
}

export interface ABIData {
  world?: {
    address: string;
    class_hash: string;
    seed: string;
    name: string;
    entrypoints: string[];
    kind: string;
    original_class_hash: string;
    abi: any[];
  };
  contracts?: Array<{
    kind: string;
    address: string;
    class_hash: string;
    original_class_hash: string;
    base_class_hash?: string;
    abi: any[];
  }>;
  // Contract class format (Scarb)
  sierra_program?: any[];
  contract_class_version?: string;
  entry_points_by_type?: {
    EXTERNAL?: Array<{
      selector: string;
      function_idx: number;
    }>;
    L1_HANDLER?: any[];
    CONSTRUCTOR?: any[];
  };
  abi?: any[];
  // Dojo manifest format
  events?: Array<{
    tag: string;
    selector: string;
    class_hash: string;
    members: any[];
  }>;
}

/**
 * Parser para el archivo abi.json de Dojo
 */
export class ABIParser {
  private abiData: ABIData | null = null;
  private contracts: Map<string, ContractInfo> = new Map();

  constructor(private abiFilePath: string = "abi.json") {}

  /**
   * Cargar y parsear el archivo ABI
   */
  async loadABI(): Promise<void> {
    try {
      const fullPath = path.resolve(process.cwd(), this.abiFilePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`ABI file not found: ${fullPath}`);
      }

      const rawData = fs.readFileSync(fullPath, "utf8");
      this.abiData = JSON.parse(rawData);
      
      console.log(`✅ ABI loaded from ${this.abiFilePath}`);
      
      // Detect file type and parse accordingly
      if (this.isDojoABI()) {
        console.log(`• Type: Dojo ABI`);
        console.log(`• World: ${this.abiData?.world?.kind} (${this.abiData?.world?.class_hash})`);
        console.log(`• Contracts: ${this.abiData?.contracts?.length}`);
        await this.parseDojoContracts();
      } else if (this.isContractClass()) {
        console.log(`• Type: Contract Class (Scarb)`);
        console.log(`• Version: ${this.abiData?.contract_class_version}`);
        console.log(`• External functions: ${this.abiData?.entry_points_by_type?.EXTERNAL?.length || 0}`);
        console.log(`• Events: ${this.abiData?.abi?.filter((item: any) => item.type === 'event').length || 0}`);
        await this.parseContractClass();
      } else {
        throw new Error("Unknown ABI format");
      }
    } catch (error) {
      console.error(`❌ Failed to load ABI:`, error);
      throw error;
    }
  }

  /**
   * Detectar si es un ABI de Dojo
   */
  private isDojoABI(): boolean {
    return !!(this.abiData?.world && this.abiData?.contracts);
  }

  /**
   * Detectar si es un contract class de Scarb
   */
  private isContractClass(): boolean {
    return !!(this.abiData?.sierra_program && this.abiData?.entry_points_by_type);
  }

  /**
   * Parsear contract class de Scarb
   */
  private async parseContractClass(): Promise<void> {
    if (!this.abiData) return;

    // Para contract class, usamos el nombre del archivo como identificador
    const contractName = path.basename(this.abiFilePath, '.contract_class.json');
    const contractInfo: ContractInfo = {
      address: "unknown", // Contract class no tiene address hasta que se despliega
      classHash: "unknown",
      name: contractName,
      kind: "ContractClass",
      events: [],
      functions: []
    };

    // Extraer eventos del ABI
    if (this.abiData.abi) {
      contractInfo.events = this.extractEvents(this.abiData.abi);
    }

    // Extraer funciones de entry_points_by_type
    if (this.abiData.entry_points_by_type?.EXTERNAL) {
      contractInfo.functions = this.extractFunctionsFromEntryPoints(
        this.abiData.entry_points_by_type.EXTERNAL,
        this.abiData.abi || []
      );
    }

    // Usar el nombre del archivo como clave
    this.contracts.set(contractName.toLowerCase(), contractInfo);
    
    console.log(`📋 Contract ${contractInfo.name}:`);
    console.log(`  • Type: Contract Class`);
    console.log(`  • Events: ${contractInfo.events.length}`);
    console.log(`  • Functions: ${contractInfo.functions.length}`);
  }

  /**
   * Parsear todos los contratos del ABI de Dojo
   */
  private async parseDojoContracts(): Promise<void> {
    if (!this.abiData?.contracts) return;

    // Extraer eventos globales del manifest
    const globalEvents = this.extractGlobalEvents();

    // Agregar el world contract si existe
    if (this.abiData.world?.address) {
      const worldContractInfo: ContractInfo = {
        address: this.abiData.world.address,
        classHash: this.abiData.world.class_hash,
        name: "World",
        kind: "world",
        events: [...globalEvents], // Solo eventos globales para el world
        functions: []
      };

      this.contracts.set(this.abiData.world.address.toLowerCase(), worldContractInfo);
      
      console.log(`📋 Contract ${worldContractInfo.name}:`);
      console.log(`  • Address: ${this.abiData.world.address}`);
      console.log(`  • Events: ${worldContractInfo.events.length}`);
      console.log(`  • Functions: ${worldContractInfo.functions.length}`);
    }

    for (const contract of this.abiData.contracts) {
      const contractInfo: ContractInfo = {
        address: contract.address,
        classHash: contract.class_hash,
        name: this.extractContractName(contract),
        kind: contract.kind,
        events: [],
        functions: []
      };

      // Extraer eventos del ABI del contrato
      const contractEvents = this.extractEvents(contract.abi);
      
      // Combinar eventos del contrato con eventos globales
      contractInfo.events = [...contractEvents, ...globalEvents];
      
      // Extraer funciones del ABI (incluyendo funciones de interfaces)
      contractInfo.functions = this.extractFunctions(contract.abi);

      this.contracts.set(contract.address.toLowerCase(), contractInfo);
      
      console.log(`📋 Contract ${contractInfo.name}:`);
      console.log(`  • Address: ${contract.address}`);
      console.log(`  • Events: ${contractInfo.events.length}`);
      console.log(`  • Functions: ${contractInfo.functions.length}`);
    }
  }

  /**
   * Extraer nombre del contrato
   */
  private extractContractName(contract: any): string {
    // Buscar en el ABI por implementaciones o interfaces
    for (const item of contract.abi) {
      if (item.type === "impl" && item.name) {
        return item.name;
      }
      if (item.type === "interface" && item.name) {
        return item.name.split("::").pop() || "Unknown";
      }
    }
    return "Unknown";
  }

  /**
   * Extraer eventos globales del manifest de Dojo
   */
  private extractGlobalEvents(): EventInfo[] {
    const events: EventInfo[] = [];
    
    if (this.abiData?.events) {
      for (const event of this.abiData.events) {
        if (event.tag && event.selector) {
          events.push({
            name: event.tag,
            selector: event.selector.toLowerCase(),
            inputs: event.members || []
          });
        }
      }
    }
    
    return events;
  }

  /**
   * Extraer eventos del ABI
   */
  private extractEvents(abi: any[]): EventInfo[] {
    const events: EventInfo[] = [];

    for (const item of abi) {
      if (item.type === "event" && item.name) {
        try {
          // Para eventos de Dojo, usar el selector pre-calculado si está disponible
          // Si no, calcular con hash.getSelectorFromName
          const selector = item.selector 
            ? item.selector.toLowerCase()
            : hash.getSelectorFromName(item.name).toLowerCase();
          
          events.push({
            name: item.name,
            selector: selector,
            inputs: item.inputs || []
          });
        } catch (error) {
          console.warn(`⚠️  Failed to get selector for event ${item.name}:`, error);
        }
      }
    }

    return events;
  }

  /**
   * Extraer funciones del ABI (incluyendo funciones en interfaces)
   */
  private extractFunctions(abi: any[]): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    for (const item of abi) {
      // Extraer funciones directas
      if (item.type === "function" && item.name) {
        try {
          const selector = hash.getSelectorFromName(item.name).toLowerCase();
          
          functions.push({
            name: item.name,
            selector: selector,
            inputs: item.inputs || [],
            outputs: item.outputs || [],
            stateMutability: item.state_mutability || "unknown"
          });
        } catch (error) {
          console.warn(`⚠️  Failed to calculate selector for function ${item.name}:`, error);
        }
      }
      
      // Extraer funciones de interfaces
      if (item.type === "interface" && item.items) {
        for (const interfaceItem of item.items) {
          if (interfaceItem.type === "function" && interfaceItem.name) {
            try {
              const selector = hash.getSelectorFromName(interfaceItem.name).toLowerCase();
              
              functions.push({
                name: interfaceItem.name,
                selector: selector,
                inputs: interfaceItem.inputs || [],
                outputs: interfaceItem.outputs || [],
                stateMutability: interfaceItem.state_mutability || "unknown"
              });
            } catch (error) {
              console.warn(`⚠️  Failed to calculate selector for interface function ${interfaceItem.name}:`, error);
            }
          }
        }
      }
    }

    return functions;
  }

  /**
   * Extraer funciones de entry_points_by_type (Contract Class)
   */
  private extractFunctionsFromEntryPoints(entryPoints: any[], abi: any[]): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // Buscar funciones en las interfaces del ABI
    const interfaceFunctions: any[] = [];
    for (const item of abi) {
      if (item.type === "interface" && item.items) {
        for (const func of item.items) {
          if (func.type === "function") {
            interfaceFunctions.push(func);
          }
        }
      }
    }

    for (const entryPoint of entryPoints) {
      // Buscar la función por índice en las interfaces
      const funcInfo = interfaceFunctions[entryPoint.function_idx];
      if (funcInfo) {
        functions.push({
          name: funcInfo.name,
          selector: entryPoint.selector.toLowerCase(),
          inputs: funcInfo.inputs || [],
          outputs: funcInfo.outputs || [],
          stateMutability: funcInfo.state_mutability || "external"
        });
      } else {
        // Si no encontramos la función en el ABI, crear una entrada básica
        functions.push({
          name: `function_${entryPoint.function_idx}`,
          selector: entryPoint.selector.toLowerCase(),
          inputs: [],
          outputs: [],
          stateMutability: "external"
        });
      }
    }

    return functions;
  }

  /**
   * Obtener todos los contratos
   */
  getContracts(): ContractInfo[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Obtener contrato por dirección
   */
  getContract(address: string): ContractInfo | undefined {
    return this.contracts.get(address.toLowerCase());
  }

  /**
   * Obtener todas las direcciones de contratos
   */
  getContractAddresses(): string[] {
    return Array.from(this.contracts.values())
      .filter(contract => contract.address !== "unknown")
      .map(contract => contract.address);
  }

  /**
   * Obtener todos los eventos de todos los contratos
   */
  getAllEvents(): EventInfo[] {
    const allEvents: EventInfo[] = [];
    for (const contract of this.contracts.values()) {
      allEvents.push(...contract.events);
    }
    return allEvents;
  }

  /**
   * Obtener todas las funciones de todos los contratos
   */
  getAllFunctions(): FunctionInfo[] {
    const allFunctions: FunctionInfo[] = [];
    for (const contract of this.contracts.values()) {
      allFunctions.push(...contract.functions);
    }
    return allFunctions;
  }

  /**
   * Obtener evento por selector
   */
  getEventBySelector(selector: string): EventInfo | undefined {
    const normalizedSelector = selector.toLowerCase();
    
    for (const contract of this.contracts.values()) {
      const event = contract.events.find(e => e.selector === normalizedSelector);
      if (event) return event;
    }
    
    return undefined;
  }

  /**
   * Obtener función por selector
   */
  getFunctionBySelector(selector: string): FunctionInfo | undefined {
    const normalizedSelector = selector.toLowerCase();
    
    for (const contract of this.contracts.values()) {
      const func = contract.functions.find(f => f.selector === normalizedSelector);
      if (func) return func;
    }
    
    return undefined;
  }

  /**
   * Verificar si el ABI está cargado
   */
  isLoaded(): boolean {
    return this.abiData !== null;
  }

  /**
   * Obtener eventos del manifest (sección global events)
   */
  getManifestEvents(): Array<{ tag: string; selector: string; class_hash: string; members: any[] }> {
    if (!this.abiData || !this.abiData.events) {
      return [];
    }
    return this.abiData.events;
  }

  /**
   * Obtener resumen del ABI
   */
  getSummary(): {
    type: string;
    world?: { kind: string; classHash: string };
    version?: string;
    contracts: number;
    totalEvents: number;
    totalFunctions: number;
    manifestEvents: number;
  } {
    if (!this.abiData) {
      throw new Error("ABI not loaded");
    }

    const totalEvents = this.getAllEvents().length;
    const totalFunctions = this.getAllFunctions().length;
    const manifestEvents = this.getManifestEvents().length;

    if (this.isDojoABI()) {
      return {
        type: "Dojo ABI",
        world: {
          kind: this.abiData.world!.kind,
          classHash: this.abiData.world!.class_hash
        },
        contracts: this.contracts.size,
        totalEvents,
        totalFunctions,
        manifestEvents
      };
    } else if (this.isContractClass()) {
      return {
        type: "Contract Class",
        version: this.abiData.contract_class_version,
        contracts: this.contracts.size,
        totalEvents,
        totalFunctions,
        manifestEvents
      };
    } else {
      throw new Error("Unknown ABI type");
    }
  }
}
