# Slack Priority Feature - Quick Start

## 1. Run Database Migration

First, add the priority column to your database:

```bash
bun migrate-slack-priority.ts
```

You should see:
```
✅ Migration complete! Restart your server to use the new priority feature.
```

## 2. Find Your Slack User ID

In Slack:
1. Click your profile picture
2. Click "More" → "Copy member ID"
3. You'll get something like `U01234ABCDE`

## 3. Update config.json

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
        "user": "U01234ABCDE"  ← Add your user ID here
      }
    }
  ]
}
```

## 4. Rebuild

```bash
cd packages/connectors/slack
bun run build
```

## 5. Restart Server

The connector will now:
- ✅ Mark messages from you as priority
- ✅ Mark messages mentioning you as priority  
- ✅ Mark replies to your threads as priority
- ✅ Only create tasks for YOUR TODOs

## 6. Use Priority Filtering

```typescript
// Get only your priority messages
slack.get_history({
  channel_id: "C01234567",
  priority_only: true
})

// Summarize priority messages from today
slack.summarize_messages({
  date_from: "2025-11-04T00:00:00Z",
  priority_only: true
})
```

## That's it!

See [SLACK_PRIORITY_FEATURE.md](docs/SLACK_PRIORITY_FEATURE.md) for full documentation.
