import { BaseHelper } from "@mcp/server/src/connections/base.js";
import type { HelperContext, ToolDefinition } from "@mcp/server/src/connections/types.js";

/** Minimal example helper ("echo") */
class EchoHelper extends BaseHelper {
  name = "echo";
  version = "0.1.0";

  init(ctx: HelperContext) {
    super.init(ctx);
    ctx.logger.info("echo.init", { config: ctx.config });
  }

  tools(): ToolDefinition[] {
    return [
      {
        name: "echo.say",
        description: "Echo a short message",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", maxLength: 200 }
          },
          required: ["text"]
        },
        handler: async ({ text }: { text: string }) => {
          return { as_of: new Date().toISOString(), message: text };
        }
      }
    ];
  }

  async start() {
    this.ctx.logger.info("echo.start");
  }
}

export default new EchoHelper();
