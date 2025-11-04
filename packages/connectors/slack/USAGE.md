# Slack Connector Usage Guide

## Quick Start

### 1. Set up Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Enable **Socket Mode** in your app settings
3. Add the following **Bot Token Scopes**:
   - `channels:history` - View messages in public channels
   - `channels:read` - View basic channel info
   - `chat:write` - Send messages
   - `groups:history` - View messages in private channels
   - `groups:read` - View basic private channel info
   - `links:read` - View URLs in messages
4. Install the app to your workspace
5. Copy the following tokens:
   - **App Token** (starts with `xapp-`)
   - **Bot Token** (starts with `xoxb-`)
   - **Signing Secret**

### 2. Configure Environment

Copy `sample.env` to `.env` and add your tokens:

```bash
SLACK_APP_TOKEN=xapp-1-A0123456789-0123456789012-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
SLACK_BOT_TOKEN=xoxb-0123456789012-0123456789012-abcdefghijklmnopqrstuvwx
SLACK_SIGNING_SECRET=abcdef1234567890abcdef1234567890
```

### 3. Configure Connector

Edit `config.json` to enable the Slack connector:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/src/index.js",
      "config": {
        "allow_channels": ["#dev", "#ai", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true
      }
    }
  ]
}
```

**Configuration Options:**

- `allow_channels` (string[]): List of channels to sync via sweeper (use `#channel-name` format)
- `sweeper_minutes` (number): Interval in minutes for background sweeper (5-15 recommended)
- `enable_todo_detection` (boolean): Auto-create inbox tasks from messages containing "TODO:"

### 4. Build and Start

```bash
# Build all packages
bun run build

# Start the MCP server
bun run dev
```

## MCP Tools

### slack.list_channels

List available Slack channels.

**Input:**
```json
{
  "limit": 50
}
```

**Output:**
```json
{
  "as_of": "2025-11-04T12:34:56.789Z",
  "source": "slack",
  "channels": [
    {
      "id": "C0123456789",
      "name": "dev",
      "is_member": true,
      "is_archived": false
    }
  ]
}
```

### slack.get_history

Get message history from a channel with compact handles.

**Input:**
```json
{
  "channel_id": "C0123456789",
  "limit": 50
}
```

**Output:**
```json
{
  "as_of": "2025-11-04T12:34:56.789Z",
  "source": "slack",
  "approx_freshness_seconds": 120,
  "items": [
    {
      "id": "C0123456789_1234567890.123456",
      "ts": "1234567890.123456",
      "uid": "U0123456789",
      "preview": "Message text (≤300 chars, plain text)",
      "link": "https://workspace.slack.com/archives/C0123456789/p1234567890123456",
      "as_of": "2025-11-04T12:34:56.789Z",
      "source": "slack",
      "approx_freshness_seconds": 120
    }
  ]
}
```

### slack.post_message

Post a message to a Slack channel.

**Input:**
```json
{
  "channel_id": "C0123456789",
  "text": "Hello from MCP!",
  "thread_ts": "1234567890.123456"
}
```

**Output:**
```json
{
  "ok": true,
  "ts": "1234567890.123457",
  "channel": "C0123456789"
}
```

## Features

### Real-time Message Ingestion

The connector listens to all `message.*` events via Socket Mode and automatically:
- Stores new messages in the `slack_messages` table
- Strips Slack formatting to plain text
- Truncates preview to ≤300 characters
- Handles message edits and deletions

### Permalink Hydration

Messages are stored without permalinks initially. A background queue:
- Processes messages without permalinks every 30 seconds
- Fetches permalinks via Slack Web API
- Respects rate limits (50+ requests/min for Tier 3)
- Retries with exponential backoff on rate limit errors

### Background Sweeper

The sweeper runs at configured intervals (default: 10 minutes) and:
- Fetches recent history from allowlisted channels
- Syncs up to 100 messages per channel
- Resolves channel names (e.g., `#dev`) to IDs automatically
- Logs progress and errors

### TODO Detection

When enabled, the connector:
- Scans messages for "TODO:" prefix
- Extracts the TODO text
- Creates an inbox task automatically
- Links the task to the Slack message

Example message:
```
TODO: Review the PR for the new feature
```

Creates a task:
```
Title: Review the PR for the new feature
Body: From Slack: C0123456789
State: inbox
Priority: med
Source: slack
```

## Testing

Run the test suite:

```bash
cd packages/connectors/slack
bun test
```

**Test Coverage:**
- Message upsert and retrieval
- Slack formatting stripping
- Preview truncation
- Message updates
- Handle format validation

## Acceptance Criteria

✅ **Start connector; post in test channel**
1. Start the MCP server with Slack connector enabled
2. Post a message in a test channel
3. Verify message appears in database

✅ **slack.get_history returns message with permalink**
1. Call `slack.get_history` with channel ID
2. Verify messages are returned with handle format
3. Verify permalinks are hydrated (may take up to 30 seconds)

✅ **Optional TODO detection creates inbox tasks**
1. Enable `enable_todo_detection` in config
2. Post a message with "TODO: Test task"
3. Verify task is created in `tasks` table
4. Verify task is linked to Slack message

## Troubleshooting

### "SLACK_APP_TOKEN and SLACK_BOT_TOKEN are required"

Make sure you've set the environment variables in `.env`:
```bash
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
```

### Messages not appearing

1. Check that the bot is invited to the channel
2. Verify the bot has the required scopes
3. Check logs for errors: `LOG_LEVEL=debug bun run dev`

### Permalinks not hydrating

1. Check rate limit logs
2. Verify bot has `links:read` scope
3. Wait up to 30 seconds for queue to process

### Sweeper not syncing channels

1. Verify channel names in `allow_channels` start with `#`
2. Check that bot is a member of the channels
3. Review sweeper logs for errors

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Slack Connector                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Bolt Socket  │───▶│   Message    │───▶│   Database   │  │
│  │     Mode     │    │   Listener   │    │   (SQLite)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                               │
│         │                    ▼                               │
│         │            ┌──────────────┐                        │
│         │            │ TODO Detector│                        │
│         │            └──────────────┘                        │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │  Permalink   │───▶│  Web API     │                       │
│  │    Queue     │    │   Client     │                       │
│  └──────────────┘    └──────────────┘                       │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Sweeper    │                                           │
│  │  (Interval)  │                                           │
│  └──────────────┘                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE slack_messages (
  id TEXT PRIMARY KEY,              -- {channel_id}_{ts}
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,                 -- Slack timestamp
  user TEXT,                        -- User ID
  text TEXT,                        -- Plain text (stripped)
  thread_ts TEXT,                   -- Thread parent timestamp
  edited_at TEXT,                   -- ISO timestamp of last edit
  deleted INTEGER DEFAULT 0,        -- 0 or 1
  permalink TEXT,                   -- Hydrated async
  created_ts TEXT NOT NULL          -- ISO timestamp
);

CREATE INDEX idx_slack_channel ON slack_messages (channel_id, ts DESC);
CREATE INDEX idx_slack_recent ON slack_messages (created_ts DESC);
CREATE INDEX idx_slack_thread ON slack_messages (thread_ts);
```

## Rate Limits

Slack API rate limits (Tier 3):
- **50+ requests per minute** for most methods
- **1 request per second** for `chat.postMessage`
- **Retry-After header** provided on rate limit errors

The connector handles rate limits automatically:
- Permalink queue: 1.2s delay between requests
- Exponential backoff on rate limit errors
- Respects `Retry-After` header

## Security

- Tokens are loaded from environment variables (never committed)
- Signing secret validates incoming requests
- Socket Mode provides secure WebSocket connection
- No public endpoints exposed

## Performance

- **Message ingestion:** Real-time via Socket Mode
- **Permalink hydration:** ~50 messages per minute
- **Sweeper:** 100 messages per channel per interval
- **Database queries:** Indexed for fast retrieval

## Next Steps

1. **Add thread support:** Fetch and display threaded conversations
2. **Add reactions:** Store and retrieve message reactions
3. **Add file attachments:** Download and store file metadata
4. **Add user profiles:** Cache user info for richer displays
5. **Add search:** Full-text search across Slack messages
