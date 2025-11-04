import type { Database } from "bun:sqlite";
import type {
  OutlookMessage,
  CalendarEvent,
  OutlookMessageRow,
  CalendarEventRow,
  OutlookMessageHandle,
  CalendarEventHandle,
} from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function preview(text: string | null | undefined, maxLen = 300): string {
  if (!text) return "";
  return text.slice(0, maxLen).trim();
}

/**
 * Upsert an Outlook message into the database
 */
export function upsertOutlookMessage(
  db: Database,
  msg: OutlookMessage,
  folder = "inbox"
): void {
  const created_ts = nowISO();
  const sender = msg.from?.emailAddress?.address || "unknown";

  const existing = db
    .query<OutlookMessageRow, [string]>("SELECT * FROM outlook_messages WHERE id = ?")
    .get(msg.id);

  if (existing) {
    // Update existing message
    db.query(`
      UPDATE outlook_messages 
      SET received_at = ?, sender = ?, subject = ?, preview = ?, web_link = ?, folder = ?
      WHERE id = ?
    `).run(
      msg.receivedDateTime,
      sender,
      msg.subject,
      preview(msg.bodyPreview),
      msg.webLink,
      folder,
      msg.id
    );
  } else {
    // Insert new message
    db.query(`
      INSERT INTO outlook_messages (id, received_at, sender, subject, preview, web_link, folder, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.receivedDateTime,
      sender,
      msg.subject,
      preview(msg.bodyPreview),
      msg.webLink,
      folder,
      created_ts
    );
  }
}

/**
 * Upsert a calendar event into the database
 */
export function upsertCalendarEvent(
  db: Database,
  event: CalendarEvent
): void {
  const created_ts = nowISO();
  const location = event.location?.displayName || null;

  const existing = db
    .query<CalendarEventRow, [string]>("SELECT * FROM calendars WHERE id = ?")
    .get(event.id);

  if (existing) {
    // Update existing event
    db.query(`
      UPDATE calendars 
      SET start = ?, end = ?, subject = ?, location = ?, web_link = ?
      WHERE id = ?
    `).run(
      event.start.dateTime,
      event.end.dateTime,
      event.subject,
      location,
      event.webLink,
      event.id
    );
  } else {
    // Insert new event
    db.query(`
      INSERT INTO calendars (id, start, end, subject, location, web_link, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.start.dateTime,
      event.end.dateTime,
      event.subject,
      location,
      event.webLink,
      created_ts
    );
  }
}

/**
 * Get Outlook messages with compact handles
 */
export function getOutlookMessages(
  db: Database,
  folder = "inbox",
  limit = 25
): OutlookMessageHandle[] {
  const rows = db.query<OutlookMessageRow, [string, number]>(`
    SELECT id, received_at, sender, subject, preview, web_link, created_ts
    FROM outlook_messages
    WHERE folder = ?
    ORDER BY received_at DESC
    LIMIT ?
  `).all(folder, limit);

  const asOf = nowISO();

  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const now = new Date(asOf);
    const freshnessSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    return {
      id: row.id,
      received_at: row.received_at,
      from: row.sender,
      subject: row.subject,
      preview: row.preview,
      link: row.web_link,
      as_of: asOf,
      source: "outlook",
      approx_freshness_seconds: freshnessSeconds,
    };
  });
}

/**
 * Get today's calendar events with compact handles
 */
export function getTodayCalendarEvents(
  db: Database
): CalendarEventHandle[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const rows = db.query<CalendarEventRow, [string, string]>(`
    SELECT id, start, end, subject, location, web_link, created_ts
    FROM calendars
    WHERE start >= ? AND start < ?
    ORDER BY start ASC
  `).all(startOfDay, endOfDay);

  const asOf = nowISO();

  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const nowTime = new Date(asOf);
    const freshnessSeconds = Math.floor((nowTime.getTime() - createdAt.getTime()) / 1000);

    return {
      id: row.id,
      start: row.start,
      end: row.end,
      subject: row.subject,
      location: row.location || undefined,
      link: row.web_link,
      as_of: asOf,
      source: "calendar",
      approx_freshness_seconds: freshnessSeconds,
    };
  });
}

/**
 * Get all calendar events in a date range
 */
export function getCalendarEventsByRange(
  db: Database,
  startDate: string,
  endDate: string
): CalendarEventHandle[] {
  const rows = db.query<CalendarEventRow, [string, string]>(`
    SELECT id, start, end, subject, location, web_link, created_ts
    FROM calendars
    WHERE start >= ? AND start < ?
    ORDER BY start ASC
  `).all(startDate, endDate);

  const asOf = nowISO();

  return rows.map((row) => {
    const createdAt = new Date(row.created_ts);
    const now = new Date(asOf);
    const freshnessSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    return {
      id: row.id,
      start: row.start,
      end: row.end,
      subject: row.subject,
      location: row.location || undefined,
      link: row.web_link,
      as_of: asOf,
      source: "calendar",
      approx_freshness_seconds: freshnessSeconds,
    };
  });
}
