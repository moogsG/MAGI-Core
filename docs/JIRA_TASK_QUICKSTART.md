# Jira Task Auto-Creation - Quick Start

## What It Does

Automatically creates tasks in your task list for any Jira tickets assigned to you that are "In Progress".

## Setup

1. **Configure Jira Connector** (if not already done)

Add to `config.json`:
```json
{
  "helpers": {
    "jira": {
      "url": "https://your-domain.atlassian.net",
      "email": "your-email@example.com",
      "api_token": "your-api-token",
      "user_account_id": "your-account-id",
      "poll_minutes": 5,
      "project_keys": ["PROJ"],
      "auto_create_tasks": true
    }
  }
}
```

2. **Start the Server**

```bash
cd packages/server
bun run daemon
```

That's it! The connector will now:
- Poll Jira every 5 minutes
- Find "In Progress" issues assigned to you
- Create tasks automatically with full context

## Verify It's Working

Run the test:
```bash
bun test-jira-task-creation.ts
```

Expected output:
```
✅ Found 3 "In Progress" issues
✅ Created task for GDEV-8524: [Halo] Which end dates matter...
✅ Created task for GDEV-8559: HOTFIX - Update to Hubspot...
✅ Created task for GDEV-6483: Syncro resync on change...

📊 Tasks created: 3
🎉 Task auto-creation feature is working!
```

## View Your Tasks

List all tasks:
```bash
cd packages/cli
bun src/cli.ts list
```

View a specific task:
```bash
bun src/cli.ts expand <task-id>
```

## Disable Auto-Creation

Set in `config.json`:
```json
{
  "helpers": {
    "jira": {
      "auto_create_tasks": false
    }
  }
}
```

## Task Format

Each task includes:
- **Title**: `JIRA-123: Issue summary`
- **Body**: Full issue details with clickable link
- **Priority**: Mapped from Jira (High/Medium/Low)
- **Due Date**: Copied from Jira if set
- **Source**: `jira:JIRA-123` (for tracking)

## Notes

- Tasks are created in `inbox` state
- No duplicates - each Jira issue creates only one task
- Only "In Progress" issues trigger task creation
- Tasks are not deleted when Jira status changes (manual cleanup)
