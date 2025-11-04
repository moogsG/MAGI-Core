import path from "node:path";
import type { HelperLogger } from "./types.js";
import { HelperRegistry } from "./registry.js";

export async function loadHelpersFromConfig(
  registry: HelperRegistry, 
  config: any, 
  logger: HelperLogger
) {
  const entries = (config?.helpers ?? []) as Array<{
    name: string; 
    module: string; 
    config?: any;
  }>;
  
  for (const entry of entries) {
    try {
      const modPath = entry.module.startsWith(".") 
        ? path.resolve(entry.module) 
        : entry.module;
      
      const mod = await import(modPath);
      const helper = mod.default || mod.helper;
      
      if (!helper || !helper.name) {
        throw new Error(`Invalid helper module: ${entry.module}`);
      }
      
      registry.register(helper);
      logger.info(`Registered helper`, { name: helper.name, module: entry.module });
    } catch (error) {
      logger.error(`Failed to load helper: ${entry.name}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}
