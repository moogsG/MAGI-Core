import type { ConnectionHelper, HelperContext, ToolDefinition } from "./types.js";

export abstract class BaseHelper implements ConnectionHelper {
  abstract name: string;
  abstract version: string;
  protected ctx!: HelperContext;
  
  init(ctx: HelperContext) { 
    this.ctx = ctx; 
  }
  
  tools(): ToolDefinition[] { 
    return []; 
  }
  
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}
