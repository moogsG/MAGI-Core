import type { DB } from "../db/index.js";

export interface ConnectionHelper {
  name: string;
  version: string;
  init(ctx: HelperContext): Promise<void> | void;
  tools(): ToolDefinition[];
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any> | any;
}

export interface HelperContext {
  db: DB;
  logger: HelperLogger;
  config: Record<string, any>;
  emit?(event: string, payload?: unknown): void;
}

export interface HelperLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string | Error, meta?: Record<string, unknown>): void;
}
