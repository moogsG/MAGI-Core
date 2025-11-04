import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { BaseHelper } from "../../../server/dist/src/connections/base.js";
import type { HelperContext, ToolDefinition } from "../../../server/dist/src/connections/types.js";
import { MsAuthManager } from "./auth.js";
import {
  upsertOutlookMessage,
  upsertCalendarEvent,
  getOutlookMessages,
  getTodayCalendarEvents,
} from "./repo.js";
import type { Database } from "bun:sqlite";
import type { MsConfig, OutlookMessage, CalendarEvent } from "./types.js";

class MsHelper extends BaseHelper {
  name = "ms";
  version = "0.1.0";

  private authManager!: MsAuthManager;
  private graphClient!: Client;
  private pollerInterval: Timer | null = null;
  private config!: MsConfig;
  private db!: Database;

  init(ctx: HelperContext) {
    super.init(ctx);
    this.db = ctx.db as Database;
    this.config = ctx.config as MsConfig;

    // Initialize auth manager
    this.authManager = new MsAuthManager(
      ctx.logger,
      this.config.client_id,
      this.config.tenant_id
    );

    ctx.logger.info("ms.init", {
      config: this.config,
      pollMinutes: this.config.poll_minutes ?? 5,
    });
  }

  private async initializeGraphClient() {
    if (!this.authManager.isAuthenticated()) {
      await this.authManager.authenticate();
    }

    const credential = this.authManager.getCredential();
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["Mail.Read", "Mail.Send", "Calendars.Read"],
    });

    this.graphClient = Client.initWithMiddleware({ authProvider });
    this.ctx.logger.info("ms.graph-client.initialized");
  }

  private async pollMessages() {
    try {
      this.ctx.logger.info("ms.poll.messages.start");

      const response = await this.graphClient
        .api("/me/messages")
        .top(25)
        .select("id,receivedDateTime,from,subject,bodyPreview,webLink")
        .orderby("receivedDateTime DESC")
        .get();

      const messages: OutlookMessage[] = response.value || [];

      for (const msg of messages) {
        upsertOutlookMessage(this.db, msg, "inbox");
      }

      this.ctx.logger.info("ms.poll.messages.done", {
        count: messages.length,
      });
    } catch (error: any) {
      this.ctx.logger.error("ms.poll.messages.error", { error: error.message });
    }
  }

  private async pollCalendar() {
    try {
      this.ctx.logger.info("ms.poll.calendar.start");

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const response = await this.graphClient
        .api("/me/calendar/calendarView")
        .query({
          startDateTime: startOfDay.toISOString(),
          endDateTime: endOfDay.toISOString(),
        })
        .select("id,subject,start,end,location,webLink")
        .orderby("start/dateTime")
        .get();

      const events: CalendarEvent[] = response.value || [];

      for (const event of events) {
        upsertCalendarEvent(this.db, event);
      }

      this.ctx.logger.info("ms.poll.calendar.done", {
        count: events.length,
      });
    } catch (error: any) {
      this.ctx.logger.error("ms.poll.calendar.error", { error: error.message });
    }
  }

  private async runPoller() {
    await Promise.all([this.pollMessages(), this.pollCalendar()]);
  }

  tools(): ToolDefinition[] {
    return [
      {
        name: "outlook.list_inbox",
        description: "List top 25 messages from Outlook inbox with compact handles",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 100, default: 25 },
          },
        },
        handler: async ({ limit = 25 }: { limit?: number }) => {
          try {
            const messages = getOutlookMessages(this.db, "inbox", limit);

            return {
              as_of: new Date().toISOString(),
              source: "outlook",
              approx_freshness_seconds: messages[0]?.approx_freshness_seconds ?? 0,
              items: messages,
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      },
      {
        name: "outlook.send_mail",
        description: "Send an email via Outlook",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              items: { type: "string" },
              description: "Recipient email addresses",
            },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email body (plain text or HTML)" },
            body_type: {
              type: "string",
              enum: ["text", "html"],
              default: "text",
              description: "Body content type",
            },
          },
          required: ["to", "subject", "body"],
        },
        handler: async ({
          to,
          subject,
          body,
          body_type = "text",
        }: {
          to: string[];
          subject: string;
          body: string;
          body_type?: "text" | "html";
        }) => {
          try {
            const message = {
              subject,
              body: {
                contentType: body_type === "html" ? "HTML" : "Text",
                content: body,
              },
              toRecipients: to.map((email) => ({
                emailAddress: { address: email },
              })),
            };

            await this.graphClient.api("/me/sendMail").post({ message });

            this.ctx.logger.info("ms.send-mail.success", {
              to,
              subject,
            });

            return {
              ok: true,
              message: "Email sent successfully",
            };
          } catch (error: any) {
            this.ctx.logger.error("ms.send-mail.error", { error: error.message });
            return { ok: false, error: error.message };
          }
        },
      },
      {
        name: "calendar.list_today",
        description: "List today's calendar events with compact handles",
        inputSchema: {
          type: "object",
          properties: {},
        },
        handler: async () => {
          try {
            const events = getTodayCalendarEvents(this.db);

            return {
              as_of: new Date().toISOString(),
              source: "calendar",
              approx_freshness_seconds: events[0]?.approx_freshness_seconds ?? 0,
              items: events,
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      },
    ];
  }

  async start() {
    this.ctx.logger.info("ms.start");

    // Initialize Graph client (will trigger device code auth if needed)
    await this.initializeGraphClient();

    // Run initial poll
    await this.runPoller().catch((err) => {
      this.ctx.logger.error("ms.poller.initial-error", { error: err });
    });

    // Start polling interval (default 5 minutes, configurable 2-10 minutes)
    const pollMinutes = Math.max(2, Math.min(10, this.config.poll_minutes ?? 5));
    this.pollerInterval = setInterval(() => {
      this.runPoller().catch((err) => {
        this.ctx.logger.error("ms.poller.error", { error: err });
      });
    }, pollMinutes * 60 * 1000);

    this.ctx.logger.info("ms.poller.scheduled", {
      intervalMinutes: pollMinutes,
    });
  }

  async stop() {
    this.ctx.logger.info("ms.stop");

    if (this.pollerInterval) {
      clearInterval(this.pollerInterval);
      this.pollerInterval = null;
    }
  }
}

export default new MsHelper();
