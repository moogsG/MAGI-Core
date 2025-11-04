# Jira Task Auto-Creation Feature

## Overview

The Jira connector now automatically creates tasks in the MAGI-Core task system for any Jira issues assigned to you that are in "In Progress" status.

## Features

### Automatic Task Creation
- **Trigger**: When the Jira connector polls for issues (default: every 5 minutes)
- **Filter**: Only creates tasks for issues with status "In Progress"
- **Duplicate Prevention**: Uses the `source` field to track which Jira issues already have tasks
- **Rich Context**: Each task includes full Jira issue details in the body

### Automatic Task Status Sync
- **Trigger**: When the Jira connector polls for issues (default: every 5 minutes)
- **Behavior**: Automatically updates tasks to "done" when their corresponding Jira issues are marked as "Done"
- **Smart Detection**: Only updates tasks that are not already in "done" state
- **Tracking**: Uses the `source` field to match tasks with Jira issues

### Task Details

Each auto-created task includes:
- **Title**: `{JIRA_KEY}: {Summary}` (e.g., "GDEV-8524: [Halo] Which end dates matter")
- **Body**: Formatted markdown with:
  - Clickable link to Jira issue
  - Issue type (Task, Bug, Story, etc.)
  - Project name and key
  - Priority
  - Due date (if set)
  - Labels (if any)
  - Full description
- **Priority**: Mapped from Jira priority:
  - Highest/Critical → `high`
  - High → `high`
  - Medium → `med` (default)
  - Low/Lowest → `low`
- **Due Date**: Copied from Jira if set
- **Source**: `jira:{ISSUE_KEY}` for tracking and preventing duplicates
- **State**: `inbox` (can be moved to `open` or `done` manually)

## Configuration

Add to your `config.json`:

```json
{
  "helpers": {
    "jira": {
      "url": "https://your-domain.atlassian.net",
      "email": "your-email@example.com",
      "api_token": "your-api-token",
      "user_account_id": "your-account-id",
      "poll_minutes": 5,
      "project_keys": ["PROJ1", "PROJ2"],
      "auto_create_tasks": true
    }
  }
}
```

### Configuration Options

- `auto_create_tasks` (optional, default: `true`): Enable/disable automatic task creation
  - Set to `false` to disable this feature
  - Set to `true` or omit to enable

## Usage

### Automatic Mode (Default)

Once configured, the Jira connector will:
1. Poll Jira every N minutes (default: 5)
2. Fetch all issues assigned to you
3. Filter for "In Progress" issues
4. Create tasks for any new "In Progress" issues
5. Skip issues that already have tasks
6. Update existing tasks to "done" when their Jira issues are marked as "Done"

### Manual Testing

Run the test script to verify the feature:

```bash
bun test-jira-task-creation.ts
```

This will:
- Fetch your Jira issues
- Filter for "In Progress" status
- Create tasks for new issues
- Show summary of created tasks

## Example Task

**Title:**
```
GDEV-8559: HOTFIX - Update to Hubspot data transfer from Gradient
```

**Body:**
```markdown
**Jira Issue:** [GDEV-8559](https://gradient-msp.atlassian.net/browse/GDEV-8559)
**Type:** Task
**Project:** Gradient (GDEV)
**Priority:** Medium
**Due Date:** 2025-11-15
**Labels:** hotfix, hubspot

**Description:**
Update the Hubspot data transfer process to handle new field mappings...
```

## Implementation Details

### Files Modified

1. **`packages/connectors/jira/src/types.ts`**
   - Added `auto_create_tasks?: boolean` to `JiraConfig`

2. **`packages/connectors/jira/src/index.ts`**
   - Added `mapJiraPriorityToTaskPriority()` helper function
   - Added `formatTaskBody()` helper function
   - Modified `pollIssues()` to create tasks for "In Progress" issues
   - Added duplicate prevention using `source` field

### Duplicate Prevention

The system prevents duplicate tasks by:
1. Storing the Jira issue key in the task's `source` field as `jira:{ISSUE_KEY}`
2. Checking for existing tasks with matching source before creating new ones
3. Using a database query: `SELECT COUNT(*) FROM tasks WHERE source = 'jira:{ISSUE_KEY}'`

### Priority Mapping

| Jira Priority | Task Priority |
|--------------|---------------|
| Highest      | high          |
| Critical     | high          |
| High         | high          |
| Medium       | med           |
| Low          | low           |
| Lowest       | low           |
| (not set)    | med           |

## Status Sync Behavior

### Task Creation
- **Trigger**: Jira issue status = "In Progress"
- **Action**: Create new task with state = "inbox"
- **Condition**: No existing task with matching `source` field

### Task Completion
- **Trigger**: Jira issue status = "Done"
- **Action**: Update existing task to state = "done"
- **Condition**: Task exists and is not already "done"

### Status Flow
```
Jira: To Do → In Progress → Done
Task: (none) → inbox → done
```

**Note**: Tasks are created when issues move to "In Progress" and automatically marked "done" when issues are completed in Jira. Manual task state changes (inbox → open) are preserved until the Jira issue is marked "Done".

## Benefits

1. **Automatic Tracking**: Never miss an "In Progress" Jira issue
2. **Rich Context**: All issue details available in the task
3. **No Duplicates**: Smart detection prevents duplicate tasks
4. **Configurable**: Can be enabled/disabled per configuration
5. **Seamless Integration**: Works with existing task management tools
6. **Automatic Completion**: Tasks are automatically marked done when Jira issues are completed

## Future Enhancements

Potential improvements:
- Support for custom status filters (not just "In Progress")
- ✅ ~~Automatic task state updates when Jira status changes~~ (Implemented: Done status sync)
- Bi-directional sync (update Jira when task is completed)
- Custom task templates
- Webhook support for real-time updates
- Support for other Jira status transitions (e.g., "In Progress" → "open", "To Do" → "inbox")

## Testing

The feature has been tested with:
- ✅ Creating tasks for "In Progress" issues
- ✅ Preventing duplicate task creation
- ✅ Proper priority mapping
- ✅ Rich task body formatting
- ✅ Due date handling
- ✅ Label inclusion
- ✅ Automatic task status sync to "done"

Test results:
- 3 "In Progress" issues found
- 3 tasks created successfully
- 0 duplicates on second run
- All tasks properly formatted with context
- Tasks automatically updated to "done" when Jira issues completed
