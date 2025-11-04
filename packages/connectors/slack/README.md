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
  - `slack.summarize_messages` - Get messages formatted for AI summarization
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

## MCP Tools

### slack.list_channels
List available Slack channels.

**Parameters:**
- `limit` (optional): Max channels to return (default: 50, max: 200)

**Returns:** List of channels with id, name, is_member, is_archived

### slack.get_history
Get message history from a specific channel.

**Parameters:**
- `channel_id` (required): Slack channel ID
- `limit` (optional): Max messages to return (default: 50, max: 200)

**Returns:** Compact message handles with preview text

### slack.post_message
Post a message to a Slack channel.

**Parameters:**
- `channel_id` (required): Slack channel ID
- `text` (required): Message text
- `thread_ts` (optional): Thread timestamp for replies

**Returns:** Success status with message timestamp

### slack.summarize_messages
Get Slack messages formatted for AI summarization.

**Parameters:**
- `channel_id` (optional): Filter by specific channel ID
- `date_from` (optional): Start date in ISO 8601 format (e.g., '2025-01-01T00:00:00Z')
- `date_to` (optional): End date in ISO 8601 format (e.g., '2025-01-31T23:59:59Z')
- `limit` (optional): Max messages to retrieve (default: 100, max: 500)

**Returns:** Formatted messages with timestamps and user info, ready for summarization

**Example usage:**
```typescript
// Get all messages from the last 7 days
{
  "date_from": "2025-10-28T00:00:00Z",
  "limit": 200
}

// Get messages from specific channel
{
  "channel_id": "C12345678",
  "limit": 100
}

// Get messages in date range
{
  "date_from": "2025-11-01T00:00:00Z",
  "date_to": "2025-11-04T23:59:59Z",
  "limit": 500
}
```

## Acceptance Criteria

✅ Start connector; post in test channel  
✅ `slack.get_history` returns message with permalink  
✅ Optional TODO detection creates inbox tasks  
✅ `slack.summarize_messages` retrieves and formats messages for AI summarization
