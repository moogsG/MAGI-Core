import { describe, it, expect, beforeAll } from "vitest";
import { Database } from "bun:sqlite";
import { upsertSlackMessage, getSlackMessagesByChannel } from "../src/repo.js";

describe("Slack Connector", () => {
  let db: Database;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(":memory:");
    
    // Create slack_messages table
    db.exec(`
      CREATE TABLE slack_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        user TEXT,
        text TEXT,
        thread_ts TEXT,
        edited_at TEXT,
        deleted INTEGER DEFAULT 0,
        permalink TEXT,
        created_ts TEXT NOT NULL
      );
      
      CREATE INDEX idx_slack_channel ON slack_messages (channel_id, ts DESC);
    `);
  });

  it("should upsert a slack message", () => {
    upsertSlackMessage(db, {
      channel_id: "C12345",
      ts: "1234567890.123456",
      user: "U12345",
      text: "Hello, world!",
      thread_ts: null
    });

    const messages = getSlackMessagesByChannel(db, "C12345", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0].preview).toBe("Hello, world!");
    expect(messages[0].ts).toBe("1234567890.123456");
  });

  it("should strip Slack formatting to plain text", () => {
    upsertSlackMessage(db, {
      channel_id: "C12345",
      ts: "1234567890.123457",
      user: "U12345",
      text: "Hey <@U67890>, check out <#C99999|general> and visit <https://example.com|our site>!",
      thread_ts: null
    });

    const messages = getSlackMessagesByChannel(db, "C12345", 10);
    const msg = messages.find(m => m.ts === "1234567890.123457");
    
    expect(msg).toBeDefined();
    expect(msg!.preview).toContain("@user");
    expect(msg!.preview).toContain("#general");
    expect(msg!.preview).toContain("our site");
  });

  it("should truncate preview to 300 chars", () => {
    const longText = "a".repeat(500);
    
    upsertSlackMessage(db, {
      channel_id: "C12345",
      ts: "1234567890.123458",
      user: "U12345",
      text: longText,
      thread_ts: null
    });

    const messages = getSlackMessagesByChannel(db, "C12345", 10);
    const msg = messages.find(m => m.ts === "1234567890.123458");
    
    expect(msg).toBeDefined();
    expect(msg!.preview.length).toBeLessThanOrEqual(300);
  });

  it("should update existing message on upsert", () => {
    const channelId = "C12345";
    const ts = "1234567890.123459";
    
    // Insert initial message
    upsertSlackMessage(db, {
      channel_id: channelId,
      ts,
      user: "U12345",
      text: "Original text",
      thread_ts: null
    });

    // Update the message
    upsertSlackMessage(db, {
      channel_id: channelId,
      ts,
      user: "U12345",
      text: "Updated text",
      edited_at: new Date().toISOString()
    });

    const messages = getSlackMessagesByChannel(db, channelId, 10);
    const msg = messages.find(m => m.ts === ts);
    
    expect(msg).toBeDefined();
    expect(msg!.preview).toBe("Updated text");
  });

  it("should return messages with handle format", () => {
    upsertSlackMessage(db, {
      channel_id: "C12345",
      ts: "1234567890.123460",
      user: "U12345",
      text: "Test message",
      permalink: "https://slack.com/archives/C12345/p1234567890123460"
    });

    const messages = getSlackMessagesByChannel(db, "C12345", 10);
    const msg = messages.find(m => m.ts === "1234567890.123460");
    
    expect(msg).toBeDefined();
    expect(msg).toHaveProperty("id");
    expect(msg).toHaveProperty("ts");
    expect(msg).toHaveProperty("uid");
    expect(msg).toHaveProperty("preview");
    expect(msg).toHaveProperty("link");
    expect(msg).toHaveProperty("as_of");
    expect(msg).toHaveProperty("source");
    expect(msg).toHaveProperty("approx_freshness_seconds");
    
    expect(msg!.source).toBe("slack");
    expect(msg!.link).toBe("https://slack.com/archives/C12345/p1234567890123460");
  });
});
