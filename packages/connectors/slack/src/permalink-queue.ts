import type { Database } from "bun:sqlite";
import { updatePermalink, getMessagesWithoutPermalinks } from "./repo.js";

export class PermalinkQueue {
  private processing = false;
  private intervalId: Timer | null = null;
  
  constructor(
    private db: Database,
    private client: any, // WebClient from @slack/bolt
    private logger: { info: (msg: string, meta?: any) => void; error: (msg: string | Error, meta?: any) => void }
  ) {}

  start(intervalMs = 30000) {
    if (this.intervalId) return;
    
    this.logger.info("permalink-queue.start", { intervalMs });
    
    // Process immediately
    this.processQueue().catch((err) => {
      this.logger.error("permalink-queue.initial-error", { error: err });
    });
    
    // Then on interval
    this.intervalId = setInterval(() => {
      this.processQueue().catch((err) => {
        this.logger.error("permalink-queue.interval-error", { error: err });
      });
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info("permalink-queue.stop");
    }
  }

  private async processQueue() {
    if (this.processing) {
      this.logger.info("permalink-queue.skip", { reason: "already-processing" });
      return;
    }

    this.processing = true;
    
    try {
      const messages = getMessagesWithoutPermalinks(this.db, 10);
      
      if (messages.length === 0) {
        return;
      }

      this.logger.info("permalink-queue.processing", { count: messages.length });

      for (const msg of messages) {
        try {
          // Rate limit: ~50 requests per minute for Tier 3
          // Add 1.2s delay between requests to be safe
          await this.sleep(1200);
          
          const result = await this.client.chat.getPermalink({
            channel: msg.channel_id,
            message_ts: msg.ts
          });

          if (result.ok && result.permalink) {
            updatePermalink(this.db, msg.id, result.permalink);
            this.logger.info("permalink-queue.hydrated", { 
              messageId: msg.id, 
              permalink: result.permalink 
            });
          }
        } catch (err: any) {
          // Handle rate limit errors
          if (err?.data?.error === "rate_limited") {
            const retryAfter = err?.data?.retry_after ?? 60;
            this.logger.info("permalink-queue.rate-limited", { 
              retryAfter, 
              messageId: msg.id 
            });
            await this.sleep(retryAfter * 1000);
          } else {
            this.logger.error("permalink-queue.error", { 
              error: err, 
              messageId: msg.id 
            });
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
