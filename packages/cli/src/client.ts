import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface MCPClientConfig {
  mode: "stdio" | "http";
  serverCommand?: string;
  serverArgs?: string[];
  httpUrl?: string;
}

export class MCPTaskClient {
  private client: Client | null = null;
  private config: MCPClientConfig;

  constructor(config?: Partial<MCPClientConfig>) {
    this.config = {
      mode: config?.mode ?? "stdio",
      serverCommand: config?.serverCommand ?? "bun",
      serverArgs: config?.serverArgs ?? ["packages/server/src/index.ts"],
      httpUrl: config?.httpUrl,
    };
  }

  async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    if (this.config.mode === "stdio") {
      await this.connectStdio();
    } else {
      throw new Error("HTTP mode not yet implemented");
    }
  }

  private async connectStdio(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.config.serverCommand!,
      args: this.config.serverArgs!,
    });

    this.client = new Client(
      {
        name: "mcp-tasks-cli",
        version: "0.1.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(transport);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

    return this.parseToolResult(result);
  }

  private parseToolResult(result: any): any {
    if (!result.content || result.content.length === 0) {
      throw new Error("Empty response from server");
    }

    const content = result.content[0];
    if (content.type !== "text") {
      throw new Error(`Unexpected content type: ${content.type}`);
    }

    try {
      return JSON.parse(content.text);
    } catch (error) {
      throw new Error(`Failed to parse response: ${content.text}`);
    }
  }

  // Convenience methods for each tool
  async createTask(params: {
    title: string;
    body?: string;
    priority?: "low" | "med" | "high";
    due_ts?: string;
    source?: string;
  }): Promise<any> {
    return this.callTool("task.create", params);
  }

  async listTasks(params?: {
    filter?: {
      state?: ("inbox" | "open" | "done")[];
      priority?: ("low" | "med" | "high")[];
      q?: string;
    };
    limit?: number;
  }): Promise<any> {
    return this.callTool("task.list", params ?? {});
  }

  async expandTask(id: string): Promise<any> {
    return this.callTool("task.expand", { id });
  }

  async updateTask(id: string, patch: Record<string, any>): Promise<any> {
    return this.callTool("task.update", { id, patch });
  }

  async queryHybrid(params: {
    query: string;
    k?: number;
    filters?: {
      state?: ("inbox" | "open" | "done")[];
      priority?: ("low" | "med" | "high")[];
    };
  }): Promise<any> {
    return this.callTool("task.queryHybrid", params);
  }
}

// Singleton instance for CLI usage
let clientInstance: MCPTaskClient | null = null;

export async function getClient(config?: Partial<MCPClientConfig>): Promise<MCPTaskClient> {
  if (!clientInstance) {
    clientInstance = new MCPTaskClient(config);
    await clientInstance.connect();
  }
  return clientInstance;
}

export async function closeClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.disconnect();
    clientInstance = null;
  }
}
