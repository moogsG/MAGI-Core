import { App } from "@slack/bolt";
import { BaseHelper } from "../../../server/dist/src/connections/base.js";
import type { HelperContext, ToolDefinition } from "../../../server/dist/src/connections/types.js";
import { upsertSlackMessage, getSlackMessagesByChannel, markMessageDeleted, getMessagesByDateRange, formatMessagesForSummary } from "./repo.js";
import { PermalinkQueue } from "./permalink-queue.js";
import type { Database } from "bun:sqlite";

interface SlackConfig {
  allow_channels?: string[];
  sweeper_minutes?: number;
  enable_todo_detection?: boolean;
  enable_background_services?: boolean; // If false, only tools are available (no Socket Mode, sweeper, etc.)
}

class SlackHelper extends BaseHelper {
  name = "slack";
  version = "0.1.0";
  
  private app!: App;
  private permalinkQueue!: PermalinkQueue;
  private sweeperInterval: Timer | null = null;
  private config!: SlackConfig;
  private db!: Database;

  init(ctx: HelperContext) {
    super.init(ctx);
    this.db = ctx.db as Database;
    this.config = ctx.config as SlackConfig;
    
    const appToken = process.env.SLACK_APP_TOKEN;
    const botToken = process.env.SLACK_BOT_TOKEN;
    
    // Only initialize Slack app if background services are enabled
    const enableBackgroundServices = this.config.enable_background_services ?? false;
    
    if (enableBackgroundServices) {
      if (!appToken || !botToken) {
        throw new Error("SLACK_APP_TOKEN and SLACK_BOT_TOKEN are required when enable_background_services is true");
      }

      // Initialize Slack Bolt app with Socket Mode
      this.app = new App({
        token: botToken,
        appToken,
        socketMode: true,
        signingSecret: process.env.SLACK_SIGNING_SECRET
      });

      // Initialize permalink hydration queue
      this.permalinkQueue = new PermalinkQueue(
        this.db,
        this.app.client,
        ctx.logger
      );

      this.setupMessageListeners();
      
      ctx.logger.info("slack.init", { 
        config: this.config,
        allowChannels: this.config.allow_channels?.length ?? 0,
        backgroundServices: true
      });
    } else {
      ctx.logger.info("slack.init", { 
        config: this.config,
        backgroundServices: false,
        note: "Only tools are available. Set enable_background_services: true for Socket Mode."
      });
    }
  }

  private setupMessageListeners() {
    // Listen to all message events
    this.app.event("message", async ({ event, logger }) => {
      try {
        // Filter subtypes we don't want to store
        if ("subtype" in event && event.subtype && !["message_changed", "message_deleted"].includes(event.subtype)) {
          return;
        }

        // Handle message deletion
        if ("subtype" in event && event.subtype === "message_deleted" && "deleted_ts" in event) {
          markMessageDeleted(this.db, event.channel, event.deleted_ts as string);
          this.ctx.logger.info("slack.message.deleted", { 
            channel: event.channel, 
            ts: event.deleted_ts 
          });
          return;
        }

        // Handle message changes
        if ("subtype" in event && event.subtype === "message_changed" && "message" in event) {
          const msg = event.message as any;
          upsertSlackMessage(this.db, {
            channel_id: event.channel,
            ts: msg.ts,
            user: msg.user,
            text: msg.text,
            thread_ts: msg.thread_ts,
            edited_at: new Date().toISOString()
          });
          
          this.ctx.logger.info("slack.message.updated", { 
            channel: event.channel, 
            ts: msg.ts 
          });
          
          // Check for TODO if enabled
          if (this.config.enable_todo_detection && msg.text?.includes("TODO:")) {
            await this.createTodoTask(msg.text, event.channel, msg.ts);
          }
          
          return;
        }

        // Handle new messages
        if ("text" in event && "ts" in event) {
          upsertSlackMessage(this.db, {
            channel_id: event.channel,
            ts: event.ts,
            user: "user" in event ? event.user : undefined,
            text: event.text,
            thread_ts: "thread_ts" in event ? event.thread_ts : undefined
          });

          this.ctx.logger.info("slack.message.new", { 
            channel: event.channel, 
            ts: event.ts,
            hasText: !!event.text
          });

          // Check for TODO if enabled
          if (this.config.enable_todo_detection && event.text?.includes("TODO:")) {
            await this.createTodoTask(event.text, event.channel, event.ts);
          }
        }
      } catch (error) {
        this.ctx.logger.error("slack.message.error", { error });
      }
    });
  }

  private async createTodoTask(text: string, channelId: string, ts: string) {
    try {
      // Extract TODO text
      const todoMatch = text.match(/TODO:\s*(.+?)(?:\n|$)/i);
      if (!todoMatch) return;

      const todoText = todoMatch[1].trim();
      
      // Create task using the tasks repo
      const taskId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      
      this.db.query(`
        INSERT INTO tasks (id, title, body, state, priority, source, created_ts, updated_ts)
        VALUES (?, ?, ?, 'inbox', 'med', 'slack', ?, ?)
      `).run(taskId, todoText, `From Slack: ${channelId}`, now, now);

      // Link to slack message
      this.db.query(`
        INSERT INTO links (task_id, kind, url)
        VALUES (?, 'slack', ?)
      `).run(taskId, `slack://channel?team=&id=${channelId}&message=${ts}`);

      this.ctx.logger.info("slack.todo.created", { 
        taskId, 
        channel: channelId, 
        ts 
      });
    } catch (error) {
      this.ctx.logger.error("slack.todo.error", { error });
    }
  }

  private async runSweeper() {
    const allowChannels = this.config.allow_channels ?? [];
    
    if (allowChannels.length === 0) {
      this.ctx.logger.info("slack.sweeper.skip", { reason: "no-allow-channels" });
      return;
    }

    this.ctx.logger.info("slack.sweeper.start", { channels: allowChannels.length });

    for (const channelName of allowChannels) {
      try {
        // Resolve channel name to ID if needed
        let channelId = channelName;
        if (channelName.startsWith("#")) {
          const result = await this.app.client.conversations.list();
          const channel = result.channels?.find((c: any) => c.name === channelName.slice(1));
          if (!channel) {
            this.ctx.logger.warn("slack.sweeper.channel-not-found", { channelName });
            continue;
          }
          channelId = channel.id!;
        }

        // Fetch recent history
        const history = await this.app.client.conversations.history({
          channel: channelId,
          limit: 100
        });

        if (history.messages) {
          for (const msg of history.messages) {
            upsertSlackMessage(this.db, {
              channel_id: channelId,
              ts: msg.ts!,
              user: msg.user,
              text: msg.text,
              thread_ts: msg.thread_ts
            });
          }

          this.ctx.logger.info("slack.sweeper.channel-done", { 
            channelId, 
            messages: history.messages.length 
          });
        }
      } catch (error) {
        this.ctx.logger.error("slack.sweeper.channel-error", { 
          channelName, 
          error 
        });
      }
    }
  }

  tools(): ToolDefinition[] {
    return [
      {
        name: "slack.list_channels",
        description: "List available Slack channels",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 }
          }
        },
        handler: async ({ limit = 50 }: { limit?: number }) => {
          try {
            const result = await this.app.client.conversations.list({
              limit,
              exclude_archived: true,
              types: "public_channel,private_channel"
            });

            const channels = (result.channels ?? []).map((ch: any) => ({
              id: ch.id,
              name: ch.name,
              is_member: ch.is_member,
              is_archived: ch.is_archived
            }));

            return {
              as_of: new Date().toISOString(),
              source: "slack",
              channels
            };
          } catch (error: any) {
            return { error: error.message };
          }
        }
      },
      {
        name: "slack.get_history",
        description: "Get message history from a channel with compact handles",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 }
          },
          required: ["channel_id"]
        },
        handler: async ({ channel_id, limit = 50 }: { channel_id: string; limit?: number }) => {
          try {
            const messages = getSlackMessagesByChannel(this.db, channel_id, limit);
            
            return {
              as_of: new Date().toISOString(),
              source: "slack",
              approx_freshness_seconds: messages[0]?.approx_freshness_seconds ?? 0,
              items: messages
            };
          } catch (error: any) {
            return { error: error.message };
          }
        }
      },
      {
        name: "slack.post_message",
        description: "Post a message to a Slack channel",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: { type: "string" },
            text: { type: "string" },
            thread_ts: { type: "string" }
          },
          required: ["channel_id", "text"]
        },
        handler: async ({ channel_id, text, thread_ts }: { channel_id: string; text: string; thread_ts?: string }) => {
          try {
            const result = await this.app.client.chat.postMessage({
              channel: channel_id,
              text,
              thread_ts
            });

            if (result.ok && result.ts) {
              // Store the message we just posted
              upsertSlackMessage(this.db, {
                channel_id,
                ts: result.ts,
                text,
                thread_ts
              });

              return {
                ok: true,
                ts: result.ts,
                channel: channel_id
              };
            }

            return { ok: false, error: "Failed to post message" };
          } catch (error: any) {
            return { ok: false, error: error.message };
          }
        }
      },
      {
        name: "slack.summarize_messages",
        description: "Get Slack messages formatted for summarization. Returns messages in chronological order with timestamps and user info.",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: { 
              type: "string",
              description: "Optional channel ID to filter messages. If not provided, returns messages from all channels."
            },
            date_from: { 
              type: "string",
              description: "Optional start date in ISO 8601 format (e.g., '2025-01-01T00:00:00Z')"
            },
            date_to: { 
              type: "string",
              description: "Optional end date in ISO 8601 format (e.g., '2025-01-31T23:59:59Z')"
            },
            limit: { 
              type: "number", 
              minimum: 1, 
              maximum: 500, 
              default: 100,
              description: "Maximum number of messages to retrieve (default: 100, max: 500)"
            }
          }
        },
        handler: async ({ channel_id, date_from, date_to, limit = 100 }: { 
          channel_id?: string; 
          date_from?: string; 
          date_to?: string; 
          limit?: number 
        }) => {
          try {
            const messages = getMessagesByDateRange(this.db, {
              channelId: channel_id,
              dateFrom: date_from,
              dateTo: date_to,
              limit
            });

            const formatted = formatMessagesForSummary(messages);

            return {
              as_of: new Date().toISOString(),
              source: "slack",
              count: messages.length,
              channel_id: channel_id ?? "all",
              date_from: date_from ?? "all",
              date_to: date_to ?? "all",
              messages: formatted
            };
          } catch (error: any) {
            return { error: error.message };
          }
        }
      }
    ];
  }

  async start() {
    const enableBackgroundServices = this.config.enable_background_services ?? false;
    
    if (!enableBackgroundServices) {
      this.ctx.logger.info("slack.start.skipped", { 
        reason: "Background services disabled" 
      });
      return;
    }

    this.ctx.logger.info("slack.start");
    
    // Start Slack Bolt app
    await this.app.start();
    this.ctx.logger.info("slack.bolt.started");

    // Start permalink hydration queue
    this.permalinkQueue.start(30000); // 30 seconds

    // Start sweeper if configured
    const sweeperMinutes = this.config.sweeper_minutes ?? 10;
    if (sweeperMinutes > 0) {
      // Run immediately
      this.runSweeper().catch((err) => {
        this.ctx.logger.error("slack.sweeper.initial-error", { error: err });
      });

      // Then on interval
      this.sweeperInterval = setInterval(() => {
        this.runSweeper().catch((err) => {
          this.ctx.logger.error("slack.sweeper.error", { error: err });
        });
      }, sweeperMinutes * 60 * 1000);

      this.ctx.logger.info("slack.sweeper.scheduled", { 
        intervalMinutes: sweeperMinutes 
      });
    }
  }

  async stop() {
    const enableBackgroundServices = this.config.enable_background_services ?? false;
    
    if (!enableBackgroundServices) {
      this.ctx.logger.info("slack.stop.skipped", { 
        reason: "Background services disabled" 
      });
      return;
    }

    this.ctx.logger.info("slack.stop");
    
    // Stop sweeper
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }

    // Stop permalink queue
    this.permalinkQueue.stop();

    // Stop Slack app
    await this.app.stop();
  }
}

export default new SlackHelper();
