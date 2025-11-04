import { describe, it, expect, beforeAll } from "vitest";
import { Database } from "bun:sqlite";
import { upsertSlackMessage, getSlackMessagesByChannel, getMessagesByDateRange, formatMessagesForSummary } from "../src/repo.js";

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

describe("Slack Message Summarization", () => {
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
      CREATE INDEX idx_slack_recent ON slack_messages (created_ts DESC);
    `);

    // Insert test messages directly with specific timestamps
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    db.exec(`
      INSERT INTO slack_messages (id, channel_id, ts, user, text, deleted, created_ts)
      VALUES 
        ('C12345_1234567890.000001', 'C12345', '1234567890.000001', 'U11111', 'Message from two days ago', 0, '${twoDaysAgo.toISOString()}'),
        ('C12345_1234567890.000002', 'C12345', '1234567890.000002', 'U22222', 'Message from yesterday', 0, '${yesterday.toISOString()}'),
        ('C67890_1234567890.000003', 'C67890', '1234567890.000003', 'U33333', 'Message from different channel', 0, '${now.toISOString()}'),
        ('C12345_1234567890.000004', 'C12345', '1234567890.000004', 'U44444', 'Recent message in channel', 0, '${now.toISOString()}')
    `);
  });

  it("should get messages by date range", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    const messages = getMessagesByDateRange(db, {
      dateFrom: twoDaysAgo.toISOString(),
      limit: 100
    });

    expect(messages.length).toBeGreaterThanOrEqual(3);
    // Messages are returned in DESC order (most recent first)
    expect(messages.some(m => m.text === "Message from yesterday")).toBe(true);
    expect(messages.some(m => m.text === "Recent message in channel")).toBe(true);
  });

  it("should filter messages by channel", () => {
    const messages = getMessagesByDateRange(db, {
      channelId: "C12345",
      limit: 100
    });

    expect(messages.length).toBe(3);
    expect(messages.every(m => m.channel_id === "C12345")).toBe(true);
  });

  it("should respect limit parameter", () => {
    const messages = getMessagesByDateRange(db, {
      limit: 2
    });

    expect(messages.length).toBeLessThanOrEqual(2);
  });

  it("should format messages for summarization", () => {
    const messages = getMessagesByDateRange(db, {
      channelId: "C12345",
      limit: 10
    });

    const formatted = formatMessagesForSummary(messages);

    expect(formatted).toContain("Found");
    expect(formatted).toContain("message(s)");
    expect(formatted).toContain("U11111");
    expect(formatted).toContain("Message from two days ago");
  });

  it("should handle empty message list", () => {
    const formatted = formatMessagesForSummary([]);
    expect(formatted).toBe("No messages found.");
  });

  it("should include timestamps in formatted output", () => {
    const messages = getMessagesByDateRange(db, {
      channelId: "C12345",
      limit: 1
    });

    const formatted = formatMessagesForSummary(messages);

    // Should contain timestamp format like [date time]
    expect(formatted).toMatch(/\[\d+\/\d+\/\d+/);
  });
});
