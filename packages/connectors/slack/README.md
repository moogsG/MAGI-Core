# Slack Connector

Slack Bolt Socket Mode connector for MAGI-Core MCP server.

## Features

- **Real-time message ingestion** via Socket Mode
- **Permalink hydration** with rate-limit-aware queue
- **Background sweeper** for allowlisted channels (5-15 min intervals)
- **MCP Tools:**
  - `slack.list_channels` - List available Slack channels
  - `slack.get_history` - Get message history with handles
  - `slack.post_message` - Post messages to channels
- **Optional TODO detection** - Auto-create inbox tasks from messages containing "TODO:"

## Configuration

Add to your `config.json`:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "@mcp/connector-slack",
      "config": {
        "allow_channels": ["#dev", "#ai", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true
      }
    }
  ]
}
```

## Environment Variables

Required:
- `SLACK_APP_TOKEN` - Slack app token for Socket Mode (xapp-*)
- `SLACK_BOT_TOKEN` - Slack bot token (xoxb-*)

Optional:
- `SLACK_SIGNING_SECRET` - Signing secret for request verification

## Database Schema

Uses the `slack_messages` table from the core migrations:

```sql
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
```

## Handle Format

All list operations return compact handles:

```typescript
{
  id: string;           // message ID
  ts: string;           // Slack timestamp
  uid: string;          // user ID
  preview: string;      // ≤300 chars plain text
  link: string | null;  // permalink (hydrated async)
  as_of: string;        // ISO timestamp
  source: string;       // "slack"
  approx_freshness_seconds: number;
}
```

## Rate Limiting

Permalink hydration is queued and processed with respect to Slack's rate limits:
- Tier 3: 50+ requests per minute
- Automatic retry with exponential backoff

## Acceptance Criteria

✅ Start connector; post in test channel  
✅ `slack.get_history` returns message with permalink  
✅ Optional TODO detection creates inbox tasks
