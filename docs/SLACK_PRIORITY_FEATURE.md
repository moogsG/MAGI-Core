# Slack Priority Feature

## Overview

The Slack connector now supports priority detection for messages. Messages that mention or reply to a configured user are automatically marked as priority, making it easier to filter and focus on relevant conversations.

## Configuration

Add a `user` field to your Slack connector configuration in `config.json`:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "allow_channels": ["#dev", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true,
        "enable_background_services": true,
        "user": "U01234ABCDE"
      }
    }
  ]
}
```

### Finding Your User ID

To find your Slack user ID:

1. Click on your profile in Slack
2. Click "More" → "Copy member ID"
3. Paste the ID (starts with `U`) into the config

## Priority Detection

Messages are marked as priority (priority = 1) when:

1. **Message is from the configured user** - Any message sent by the user
2. **Message mentions the configured user** - Contains `<@U01234ABCDE>` 
3. **Message is a reply to the user's thread** - Reply in a thread started by the user

All other messages have priority = 0.

## TODO Detection Filtering

When `enable_todo_detection` is enabled and a `user` is configured:

- **Only messages from the configured user** containing "TODO:" will create tasks
- Messages from other users with "TODO:" are ignored
- This prevents task spam from other team members

Example:
```
User U01234ABCDE: "TODO: Review the PR before EOD"  ✓ Creates task
Other user: "TODO: Update docs"                      ✗ Ignored
```

## MCP Tools

### slack.get_history

Get message history with optional priority filtering:

```typescript
{
  channel_id: "C01234567",
  limit: 50,
  priority_only: true  // Only return priority messages
}
```

Response includes priority flag:
```json
{
  "items": [
    {
      "id": "C01234567_1699104000.123456",
      "ts": "1699104000.123456",
      "uid": "U01234ABCDE",
      "preview": "Can you review this?",
      "priority": true,
      "link": "https://...",
      "as_of": "2025-11-04T12:00:00Z",
      "source": "slack",
      "approx_freshness_seconds": 120
    }
  ]
}
```

### slack.summarize_messages

Get formatted messages with priority filtering:

```typescript
{
  channel_id: "C01234567",
  date_from: "2025-11-01T00:00:00Z",
  date_to: "2025-11-04T23:59:59Z",
  limit: 100,
  priority_only: true  // Only return priority messages
}
```

## Database Schema

The `slack_messages` table now includes:

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
  priority INTEGER DEFAULT 0,  -- NEW: 1 for priority, 0 for normal
  created_ts TEXT NOT NULL
);

CREATE INDEX idx_slack_priority ON slack_messages (priority DESC, created_ts DESC);
```

## Migration

To add the priority column to existing databases:

```bash
bun migrate_slack_priority.ts
```

Or manually:

```sql
ALTER TABLE slack_messages ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX idx_slack_priority ON slack_messages (priority DESC, created_ts DESC);
```

## Use Cases

### Focus on Your Mentions

```typescript
// Get only messages that mention you
slack.get_history({
  channel_id: "C01234567",
  priority_only: true,
  limit: 20
})
```

### Daily Standup Summary

```typescript
// Get priority messages from today
slack.summarize_messages({
  date_from: "2025-11-04T00:00:00Z",
  priority_only: true
})
```

### Personal TODO Management

With `user` configured, only your TODOs create tasks:

```
You: "TODO: Fix the bug in auth.ts"        → Task created
Teammate: "TODO: Update the README"        → Ignored
```

## Logging

Priority detection is logged:

```
slack.message.new { channel: "C01234567", ts: "1699104000.123456", priority: true }
slack.todo.created { taskId: "t_123", userId: "U01234ABCDE" }
slack.todo.skipped { reason: "not-from-priority-user", userId: "U98765XYZ" }
```

## Best Practices

1. **Set your user ID** - Configure your Slack user ID to enable priority detection
2. **Use priority_only sparingly** - Most queries should include all messages; use filtering for focused views
3. **Combine with date filters** - Priority + date range gives best results
4. **Monitor TODO creation** - Check logs to ensure TODOs are being created correctly

## Troubleshooting

### Priority not being detected

- Verify user ID is correct (starts with `U`)
- Check that messages contain `<@U01234ABCDE>` format (not just @username)
- Ensure database migration was applied

### TODOs not being created

- Confirm `enable_todo_detection: true` in config
- Verify `user` is set in config
- Check that message is from the configured user
- Look for `slack.todo.skipped` logs

### Thread replies not marked as priority

- Thread detection looks up the parent message
- Ensure parent message exists in database
- Check that `thread_ts` is being captured correctly

## Common Issues

### Error: "no such column: priority"

This means the database migration hasn't been applied yet.

**Solution:**

1. Run the migration script:
   ```bash
   bun migrate-slack-priority.ts
   ```

2. Verify the migration:
   ```bash
   bun -e "
   import { Database } from 'bun:sqlite';
   const db = new Database('data/tasks.db');
   const cols = db.query('PRAGMA table_info(slack_messages)').all();
   console.log('Columns:', cols.map(c => c.name).join(', '));
   db.close();
   "
   ```

3. Restart your server

The migration script will automatically find and update all database files in your project.

### Multiple Database Files

If you have multiple `.db` files (e.g., `data/tasks.db`, `packages/server/tasks.db`), the migration script will update all of them. Make sure to run it from the project root:

```bash
cd /Users/morgan.greff/workspace/MAGI-Core
bun migrate-slack-priority.ts
```
