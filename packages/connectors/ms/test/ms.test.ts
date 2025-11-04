import { describe, it, expect, beforeEach } from "vitest";
import { Database } from "bun:sqlite";
import {
  upsertOutlookMessage,
  upsertCalendarEvent,
  getOutlookMessages,
  getTodayCalendarEvents,
} from "../src/repo.js";
import type { OutlookMessage, CalendarEvent } from "../src/types.js";

describe("MS Connector Repository", () => {
  let db: Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(":memory:");

    // Create tables
    db.exec(`
      CREATE TABLE outlook_messages (
        id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL,
        sender TEXT,
        subject TEXT,
        preview TEXT,
        web_link TEXT,
        folder TEXT,
        created_ts TEXT NOT NULL
      );

      CREATE TABLE calendars (
        id TEXT PRIMARY KEY,
        start TEXT NOT NULL,
        end TEXT NOT NULL,
        subject TEXT,
        location TEXT,
        web_link TEXT,
        created_ts TEXT NOT NULL
      );
    `);
  });

  describe("upsertOutlookMessage", () => {
    it("should insert a new message", () => {
      const message: OutlookMessage = {
        id: "msg-1",
        receivedDateTime: "2025-01-01T10:00:00Z",
        from: {
          emailAddress: {
            name: "John Doe",
            address: "john@example.com",
          },
        },
        subject: "Test Email",
        bodyPreview: "This is a test email body preview",
        webLink: "https://outlook.office.com/mail/msg-1",
      };

      upsertOutlookMessage(db, message);

      const result = db
        .query("SELECT * FROM outlook_messages WHERE id = ?")
        .get("msg-1") as any;

      expect(result).toBeDefined();
      expect(result.id).toBe("msg-1");
      expect(result.subject).toBe("Test Email");
      expect(result.sender).toBe("john@example.com");
    });

    it("should update an existing message", () => {
      const message: OutlookMessage = {
        id: "msg-1",
        receivedDateTime: "2025-01-01T10:00:00Z",
        from: {
          emailAddress: {
            address: "john@example.com",
          },
        },
        subject: "Test Email",
        bodyPreview: "Original preview",
        webLink: "https://outlook.office.com/mail/msg-1",
      };

      upsertOutlookMessage(db, message);

      // Update with new subject
      const updatedMessage: OutlookMessage = {
        ...message,
        subject: "Updated Email",
        bodyPreview: "Updated preview",
      };

      upsertOutlookMessage(db, updatedMessage);

      const result = db
        .query("SELECT * FROM outlook_messages WHERE id = ?")
        .get("msg-1") as any;

      expect(result.subject).toBe("Updated Email");
      expect(result.preview).toContain("Updated preview");
    });
  });

  describe("upsertCalendarEvent", () => {
    it("should insert a new calendar event", () => {
      const event: CalendarEvent = {
        id: "event-1",
        subject: "Team Meeting",
        start: {
          dateTime: "2025-01-01T14:00:00Z",
          timeZone: "UTC",
        },
        end: {
          dateTime: "2025-01-01T15:00:00Z",
          timeZone: "UTC",
        },
        location: {
          displayName: "Conference Room A",
        },
        webLink: "https://outlook.office.com/calendar/event-1",
      };

      upsertCalendarEvent(db, event);

      const result = db
        .query("SELECT * FROM calendars WHERE id = ?")
        .get("event-1") as any;

      expect(result).toBeDefined();
      expect(result.id).toBe("event-1");
      expect(result.subject).toBe("Team Meeting");
      expect(result.location).toBe("Conference Room A");
    });

    it("should update an existing calendar event", () => {
      const event: CalendarEvent = {
        id: "event-1",
        subject: "Team Meeting",
        start: {
          dateTime: "2025-01-01T14:00:00Z",
          timeZone: "UTC",
        },
        end: {
          dateTime: "2025-01-01T15:00:00Z",
          timeZone: "UTC",
        },
        webLink: "https://outlook.office.com/calendar/event-1",
      };

      upsertCalendarEvent(db, event);

      // Update with new subject
      const updatedEvent: CalendarEvent = {
        ...event,
        subject: "Updated Meeting",
      };

      upsertCalendarEvent(db, updatedEvent);

      const result = db
        .query("SELECT * FROM calendars WHERE id = ?")
        .get("event-1") as any;

      expect(result.subject).toBe("Updated Meeting");
    });
  });

  describe("getOutlookMessages", () => {
    it("should return messages with handles", () => {
      const messages: OutlookMessage[] = [
        {
          id: "msg-1",
          receivedDateTime: "2025-01-01T10:00:00Z",
          from: { emailAddress: { address: "john@example.com" } },
          subject: "Email 1",
          bodyPreview: "Preview 1",
          webLink: "https://outlook.office.com/mail/msg-1",
        },
        {
          id: "msg-2",
          receivedDateTime: "2025-01-01T11:00:00Z",
          from: { emailAddress: { address: "jane@example.com" } },
          subject: "Email 2",
          bodyPreview: "Preview 2",
          webLink: "https://outlook.office.com/mail/msg-2",
        },
      ];

      messages.forEach((msg) => upsertOutlookMessage(db, msg));

      const handles = getOutlookMessages(db, "inbox", 10);

      expect(handles).toHaveLength(2);
      expect(handles[0].id).toBe("msg-2"); // Most recent first
      expect(handles[0].source).toBe("outlook");
      expect(handles[0].as_of).toBeDefined();
      expect(handles[0].approx_freshness_seconds).toBeGreaterThanOrEqual(0);
    });

    it("should respect limit parameter", () => {
      const messages: OutlookMessage[] = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        receivedDateTime: new Date(2025, 0, 1, 10, i).toISOString(),
        from: { emailAddress: { address: `user${i}@example.com` } },
        subject: `Email ${i}`,
        bodyPreview: `Preview ${i}`,
        webLink: `https://outlook.office.com/mail/msg-${i}`,
      }));

      messages.forEach((msg) => upsertOutlookMessage(db, msg));

      const handles = getOutlookMessages(db, "inbox", 5);

      expect(handles).toHaveLength(5);
    });
  });

  describe("getTodayCalendarEvents", () => {
    it("should return today's events", () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const todayEvent: CalendarEvent = {
        id: "event-today",
        subject: "Today's Meeting",
        start: {
          dateTime: new Date(today.getTime() + 10 * 60 * 60 * 1000).toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(),
          timeZone: "UTC",
        },
        webLink: "https://outlook.office.com/calendar/event-today",
      };

      const tomorrowEvent: CalendarEvent = {
        id: "event-tomorrow",
        subject: "Tomorrow's Meeting",
        start: {
          dateTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000).toISOString(),
          timeZone: "UTC",
        },
        webLink: "https://outlook.office.com/calendar/event-tomorrow",
      };

      upsertCalendarEvent(db, todayEvent);
      upsertCalendarEvent(db, tomorrowEvent);

      const handles = getTodayCalendarEvents(db);

      expect(handles).toHaveLength(1);
      expect(handles[0].id).toBe("event-today");
      expect(handles[0].source).toBe("calendar");
    });
  });
});
