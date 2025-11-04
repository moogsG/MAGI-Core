import type { Database } from "bun:sqlite";
import type { SlackMessage, SlackMessageHandle } from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function preview(text: string | null | undefined, maxLen = 300): string {
  if (!text) return "";
  // Strip to plain text (remove Slack formatting)
  const plain = text
    .replace(/<@[UW][A-Z0-9]+>/g, "@user") // mentions
    .replace(/<#[C][A-Z0-9]+\|([^>]+)>/g, "#$1") // channel links
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2") // links with labels
    .replace(/<([^>]+)>/g, "$1") // plain links
    .replace(/```[^`]*```/g, "[code]") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*([^*]+)\*/g, "$1") // bold
    .replace(/_([^_]+)_/g, "$1") // italic
    .replace(/~([^~]+)~/g, "$1") // strikethrough
    .trim();
  
  return plain.slice(0, maxLen);
}

export function upsertSlackMessage(
  db: Database,
  msg: {
    channel_id: string;
    ts: string;
    user?: string | null;
    text?: string | null;
    thread_ts?: string | null;
    edited_at?: string | null;
    deleted?: boolean;
    permalink?: string | null;
  }
): void {
  const id = `${msg.channel_id}_${msg.ts}`;
  const created_ts = nowISO();
  
  const existing = db
    .query<SlackMessage, [string]>("SELECT * FROM slack_messages WHERE id = ?")
    .get(id);

  if (existing) {
    // Update existing message
    db.query(`
      UPDATE slack_messages 
      SET user = ?, text = ?, thread_ts = ?, edited_at = ?, deleted = ?, permalink = ?
      WHERE id = ?
    `).run(
      msg.user ?? existing.user,
      msg.text ?? existing.text,
      msg.thread_ts ?? existing.thread_ts,
      msg.edited_at ?? existing.edited_at,
      msg.deleted ? 1 : existing.deleted,
      msg.permalink ?? existing.permalink,
      id
    );
  } else {
    // Insert new message
    db.query(`
      INSERT INTO slack_messages (id, channel_id, ts, user, text, thread_ts, edited_at, deleted, permalink, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      msg.channel_id,
      msg.ts,
      msg.user ?? null,
      msg.text ?? null,
      msg.thread_ts ?? null,
      msg.edited_at ?? null,
      msg.deleted ? 1 : 0,
      msg.permalink ?? null,
      created_ts
    );
  }
}

export function getSlackMessagesByChannel(
  db: Database,
  channelId: string,
  limit = 50
): SlackMessageHandle[] {
  const rows = db.query<any, [string, number]>(`
    SELECT id, ts, user, text, permalink, created_ts
    FROM slack_messages
    WHERE channel_id = ? AND deleted = 0
    ORDER BY ts DESC
    LIMIT ?
  `).all(channelId, limit);

  const asOf = nowISO();
  
  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const now = new Date(asOf);
    const freshnessSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    
    return {
      id: row.id,
      ts: row.ts,
      uid: row.user,
      preview: preview(row.text),
      link: row.permalink,
      as_of: asOf,
      source: "slack",
      approx_freshness_seconds: freshnessSeconds
    };
  });
}

export function updatePermalink(
  db: Database,
  messageId: string,
  permalink: string
): void {
  db.query(`
    UPDATE slack_messages 
    SET permalink = ?
    WHERE id = ?
  `).run(permalink, messageId);
}

export function getMessagesWithoutPermalinks(
  db: Database,
  limit = 10
): Array<{ id: string; channel_id: string; ts: string }> {
  return db.query<any, [number]>(`
    SELECT id, channel_id, ts
    FROM slack_messages
    WHERE permalink IS NULL AND deleted = 0
    ORDER BY created_ts DESC
    LIMIT ?
  `).all(limit);
}

export function markMessageDeleted(
  db: Database,
  channelId: string,
  ts: string
): void {
  const id = `${channelId}_${ts}`;
  db.query(`
    UPDATE slack_messages 
    SET deleted = 1
    WHERE id = ?
  `).run(id);
}

export function getRecentMessages(
  db: Database,
  limit = 100
): SlackMessageHandle[] {
  const rows = db.query<any, [number]>(`
    SELECT id, ts, user, text, permalink, created_ts, channel_id
    FROM slack_messages
    WHERE deleted = 0
    ORDER BY created_ts DESC
    LIMIT ?
  `).all(limit);

  const asOf = nowISO();
  
  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const now = new Date(asOf);
    const freshnessSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    
    return {
      id: row.id,
      ts: row.ts,
      uid: row.user,
      preview: preview(row.text),
      link: row.permalink,
      as_of: asOf,
      source: "slack",
      approx_freshness_seconds: freshnessSeconds
    };
  });
}
