import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { DB } from "./db/index.js";
import { createTask, expandTask, listTaskHandles, updateTask } from "./tasks/repo.js";

export function buildServer(db: DB) {
  const server = new Server(
    { name: "mcp-local-tasks", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "task.create",
          description: "Create a local task",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              priority: { type: "string", enum: ["low", "med", "high"] },
              due_ts: { type: "string" },
              source: { type: "string" }
            },
            required: ["title"]
          }
        },
        {
          name: "task.list",
          description: "List tasks as compact handles",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "object",
                properties: {
                  state: { type: "array", items: { type: "string", enum: ["inbox", "open", "done"] } },
                  priority: { type: "array", items: { type: "string", enum: ["low", "med", "high"] } },
                  q: { type: "string" }
                }
              },
              limit: { type: "number", minimum: 1, maximum: 100 }
            }
          }
        },
        {
          name: "task.expand",
          description: "Return full task",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" }
            },
            required: ["id"]
          }
        },
        {
          name: "task.update",
          description: "Patch fields on a task",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
              patch: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: ["string", "null"] },
                  state: { type: "string", enum: ["inbox", "open", "done"] },
                  priority: { type: "string", enum: ["low", "med", "high"] },
                  estimate_min: { type: ["number", "null"] },
                  due_ts: { type: ["string", "null"] },
                  source: { type: ["string", "null"] },
                  summary: { type: ["string", "null"] }
                }
              }
            },
            required: ["id", "patch"]
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "task.create": {
          const result = createTask(db, args as any);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "task.list": {
          const { filter, limit } = args as any;
          const items = listTaskHandles(db, {
            limit: limit ?? 20,
            state: filter?.state,
            priority: filter?.priority,
            q: filter?.q ?? null
          });
          const result = { as_of: new Date().toISOString(), source: "db", items, next: null };
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "task.expand": {
          const { id } = args as any;
          const result = expandTask(db, id) ?? { error: "NOT_FOUND" };
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "task.update": {
          const { id, patch } = args as any;
          const result = updateTask(db, id, patch);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
    }
  });

  return server;
}

export async function startServer(db: DB) {
  const server = buildServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-local-tasks] stdio server started");
}
