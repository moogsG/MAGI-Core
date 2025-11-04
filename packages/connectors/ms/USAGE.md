# Microsoft Connector Usage Examples

## Quick Start

After setting up the connector (see README.md), the tools will be available in your MCP server.

## Example 1: List Recent Emails

```typescript
// List the 10 most recent emails
const result = await callTool("outlook.list_inbox", { limit: 10 });

console.log(result);
// {
//   as_of: "2025-01-01T12:00:00Z",
//   source: "outlook",
//   approx_freshness_seconds: 120,
//   items: [
//     {
//       id: "AAMkAGI...",
//       received_at: "2025-01-01T11:30:00Z",
//       from: "colleague@company.com",
//       subject: "Q1 Planning Meeting",
//       preview: "Hi team, I wanted to schedule our Q1 planning...",
//       link: "https://outlook.office.com/mail/...",
//       as_of: "2025-01-01T12:00:00Z",
//       source: "outlook",
//       approx_freshness_seconds: 120
//     },
//     // ... more messages
//   ]
// }
```

## Example 2: Send an Email

```typescript
// Send a plain text email
const result = await callTool("outlook.send_mail", {
  to: ["recipient@example.com"],
  subject: "Project Update",
  body: "Hi,\n\nHere's the latest update on the project...\n\nBest regards",
  body_type: "text"
});

console.log(result);
// { ok: true, message: "Email sent successfully" }
```

## Example 3: Send HTML Email

```typescript
// Send an HTML formatted email
const result = await callTool("outlook.send_mail", {
  to: ["team@company.com", "manager@company.com"],
  subject: "Weekly Report",
  body: `
    <html>
      <body>
        <h1>Weekly Report</h1>
        <p>Here are the highlights from this week:</p>
        <ul>
          <li>Completed feature X</li>
          <li>Fixed bug Y</li>
          <li>Started work on Z</li>
        </ul>
        <p>Best regards,<br>Your Name</p>
      </body>
    </html>
  `,
  body_type: "html"
});
```

## Example 4: View Today's Calendar

```typescript
// Get all events scheduled for today
const result = await callTool("calendar.list_today", {});

console.log(result);
// {
//   as_of: "2025-01-01T12:00:00Z",
//   source: "calendar",
//   approx_freshness_seconds: 120,
//   items: [
//     {
//       id: "AAMkAGI...",
//       start: "2025-01-01T14:00:00Z",
//       end: "2025-01-01T15:00:00Z",
//       subject: "Team Standup",
//       location: "Conference Room A",
//       link: "https://outlook.office.com/calendar/...",
//       as_of: "2025-01-01T12:00:00Z",
//       source: "calendar",
//       approx_freshness_seconds: 120
//     },
//     {
//       id: "AAMkAGI...",
//       start: "2025-01-01T16:00:00Z",
//       end: "2025-01-01T17:00:00Z",
//       subject: "Client Call",
//       link: "https://outlook.office.com/calendar/...",
//       as_of: "2025-01-01T12:00:00Z",
//       source: "calendar",
//       approx_freshness_seconds: 120
//     }
//   ]
// }
```

## Example 5: Check for Urgent Emails

```typescript
// List recent emails and filter for urgent ones
const result = await callTool("outlook.list_inbox", { limit: 25 });

const urgentEmails = result.items.filter(email => 
  email.subject.toLowerCase().includes("urgent") ||
  email.subject.toLowerCase().includes("asap")
);

console.log(`Found ${urgentEmails.length} urgent emails`);
urgentEmails.forEach(email => {
  console.log(`- ${email.subject} from ${email.from}`);
});
```

## Example 6: Morning Briefing

```typescript
// Get a morning briefing of emails and calendar
async function getMorningBriefing() {
  const [emails, calendar] = await Promise.all([
    callTool("outlook.list_inbox", { limit: 10 }),
    callTool("calendar.list_today", {})
  ]);

  console.log("📧 Recent Emails:");
  emails.items.slice(0, 5).forEach(email => {
    console.log(`  - ${email.subject} (${email.from})`);
  });

  console.log("\n📅 Today's Schedule:");
  calendar.items.forEach(event => {
    const start = new Date(event.start).toLocaleTimeString();
    console.log(`  - ${start}: ${event.subject}`);
  });
}

await getMorningBriefing();
```

## Example 7: Auto-Reply to Specific Sender

```typescript
// Check for emails from a specific sender and auto-reply
const result = await callTool("outlook.list_inbox", { limit: 25 });

const bossEmails = result.items.filter(email => 
  email.from === "boss@company.com"
);

if (bossEmails.length > 0) {
  await callTool("outlook.send_mail", {
    to: ["boss@company.com"],
    subject: "Re: " + bossEmails[0].subject,
    body: "Thank you for your email. I'll review it and get back to you shortly."
  });
}
```

## Example 8: Meeting Reminder

```typescript
// Check for upcoming meetings in the next hour
const result = await callTool("calendar.list_today", {});

const now = new Date();
const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

const upcomingMeetings = result.items.filter(event => {
  const eventStart = new Date(event.start);
  return eventStart > now && eventStart < oneHourFromNow;
});

if (upcomingMeetings.length > 0) {
  console.log("⏰ Upcoming meetings in the next hour:");
  upcomingMeetings.forEach(meeting => {
    const start = new Date(meeting.start).toLocaleTimeString();
    console.log(`  - ${start}: ${meeting.subject}`);
    if (meeting.location) {
      console.log(`    Location: ${meeting.location}`);
    }
  });
}
```

## Understanding Metadata

All responses include metadata for tracking freshness:

- `as_of`: Timestamp when the data was retrieved
- `source`: Data source identifier ("outlook" or "calendar")
- `approx_freshness_seconds`: Approximate age of the data in seconds

This helps you understand how recent the data is and whether you might want to trigger a manual refresh.

## Polling Behavior

The connector automatically polls for new data every 2-10 minutes (configurable). This means:

- Recent emails are always available without API calls
- Calendar events are kept up-to-date
- You can check `approx_freshness_seconds` to see data age
- Manual API calls are not needed for most use cases

## Error Handling

```typescript
try {
  const result = await callTool("outlook.send_mail", {
    to: ["invalid-email"],
    subject: "Test",
    body: "Test"
  });
  
  if (!result.ok) {
    console.error("Failed to send email:", result.error);
  }
} catch (error) {
  console.error("Tool call failed:", error);
}
```

## Best Practices

1. **Use appropriate limits**: Don't fetch more data than you need
2. **Check freshness**: Use `approx_freshness_seconds` to understand data age
3. **Handle errors**: Always check for `ok: false` or `error` fields
4. **Batch operations**: Use Promise.all() for parallel tool calls
5. **Respect rate limits**: The connector handles this internally, but avoid excessive manual calls
