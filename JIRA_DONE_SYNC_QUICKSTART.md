# Jira "Done" Status Sync - Quick Start

## What It Does

Automatically updates MAGI-Core tasks to "done" when their corresponding Jira issues are marked as "Done".

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Jira Issue Status Changes                              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Jira Connector Polls (every 5 minutes)                 │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Check Issue Status                                      │
│  ├─ "In Progress" + No Task → Create Task (inbox)       │
│  └─ "Done" + Task Exists → Update Task (done)           │
└─────────────────────────────────────────────────────────┘
```

## Quick Test

### 1. Test Status Sync
```bash
bun test-jira-done-sync.ts
```

**Expected Output:**
```
🧪 Jira Task Status Sync Test
============================================================
✅ Configuration loaded
✅ Database connected
📋 Fetching Jira issues...
✅ Retrieved 15 issues
✅ Found 3 "Done" issues

🔄 Simulating task status sync for 'Done' issues...
  ✅ Updated task t_abc123 to "done" for GDEV-8524
  ⏭️  Task t_def456 already "done" for GDEV-8559
  ⚠️  No task found for GDEV-8600

📊 Status Sync Summary:
  - Done issues found: 3
  - Tasks updated to "done": 1
  - Tasks already "done": 1
  - Tasks not found: 1
```

### 2. Test Complete Sync (Creation + Status)
```bash
bun test-jira-full-sync.ts
```

**Expected Output:**
```
🧪 Jira Complete Task Sync Test
============================================================
✅ Configuration loaded
✅ Database connected
📋 Fetching Jira issues...
✅ Retrieved 15 issues

🔄 Simulating complete task sync...
  ✅ Created task for GDEV-8700: New feature implementation...
  ✅ Updated task t_xyz789 to "done" for GDEV-8524

📊 Issue Status Breakdown:
  - In Progress: 5
  - Done: 8
  - To Do: 2

📊 Sync Summary:
  - Total issues: 15
  - Tasks created: 1
  - Tasks updated to "done": 1
```

## Real-World Usage

### Scenario 1: Start Working on a Jira Issue
1. Move Jira issue to "In Progress"
2. Wait for next poll (max 5 minutes)
3. Task automatically created in MAGI-Core with state "inbox"

### Scenario 2: Complete a Jira Issue
1. Mark Jira issue as "Done"
2. Wait for next poll (max 5 minutes)
3. Task automatically updated to state "done"

### Scenario 3: Manual Task Management
1. Task created from "In Progress" Jira issue (state: "inbox")
2. Manually move task to "open" in MAGI-Core
3. Complete Jira issue (mark as "Done")
4. Task automatically updated to "done" (overrides "open" state)

## Configuration

### Enable (Default)
```json
{
  "helpers": {
    "jira": {
      "auto_create_tasks": true
    }
  }
}
```

### Disable
```json
{
  "helpers": {
    "jira": {
      "auto_create_tasks": false
    }
  }
}
```

## Monitoring

### Check Logs
```bash
# Look for these log events:
# - jira.task.created (new task created)
# - jira.task.updated_to_done (task marked done)
# - jira.poll.done (summary with counts)
```

### Example Log Output
```json
{
  "event": "jira.task.updated_to_done",
  "issue_key": "GDEV-8524",
  "task_id": "t_abc12345"
}

{
  "event": "jira.poll.done",
  "count": 15,
  "tasks_created": 1,
  "tasks_updated_to_done": 2
}
```

## Troubleshooting

### Task Not Created
- ✅ Check Jira issue status is "In Progress"
- ✅ Verify `auto_create_tasks` is `true` (default)
- ✅ Wait for next poll cycle (max 5 minutes)
- ✅ Check logs for errors

### Task Not Updated to Done
- ✅ Check Jira issue status is "Done"
- ✅ Verify task exists with `source: "jira:{ISSUE_KEY}"`
- ✅ Wait for next poll cycle (max 5 minutes)
- ✅ Check if task is already "done" (idempotent)

### Force Immediate Sync
```bash
# Restart the server to trigger immediate poll
bun packages/server/src/cli.ts
```

## Key Points

✅ **Automatic**: No manual intervention needed
✅ **Bi-directional Awareness**: Tasks reflect Jira status
✅ **Idempotent**: Safe to run multiple times
✅ **Efficient**: Only updates what's needed
✅ **Logged**: Full audit trail of changes

## Next Steps

1. ✅ Feature is already enabled by default
2. ✅ Monitor logs for task creation and updates
3. ✅ Test with your own Jira issues
4. ✅ Enjoy automatic task management!

## Support

For issues or questions:
- Check `docs/JIRA_TASK_AUTO_CREATION.md` for detailed documentation
- Review `JIRA_DONE_SYNC_IMPLEMENTATION.md` for technical details
- Run test scripts to verify functionality
