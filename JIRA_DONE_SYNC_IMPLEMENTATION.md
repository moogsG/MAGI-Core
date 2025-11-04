# Jira Task "Done" Status Sync Implementation

## Overview

Extended the Jira connector to automatically update MAGI-Core tasks to "done" state when their corresponding Jira issues are marked as "Done".

## Implementation Summary

### Changes Made

#### 1. Updated `packages/connectors/jira/src/index.ts`

**Import Changes:**
- Added `updateTask` import from task repository

**Logic Changes in `pollIssues()` method:**
- Modified task existence check to retrieve both `id` and `state` fields
- Added new condition to check for "Done" Jira issues
- Implemented automatic task state update to "done" when:
  - Jira issue status is "Done"
  - Task exists with matching `source` field
  - Task is not already in "done" state
- Added `tasksUpdatedToDone` counter for logging
- Enhanced logging to include `tasks_updated_to_done` metric

**Code Flow:**
```typescript
for (const issue of issues) {
  upsertJiraIssue(this.db, issue);
  
  if (autoCreateTasks) {
    const existingTask = db.query("SELECT id, state FROM tasks WHERE source = ?")
      .get(`jira:${issue.key}`);
    
    if (issue.status === "In Progress" && !existingTask) {
      // Create new task
      createTask(...);
    } else if (issue.status === "Done" && existingTask && existingTask.state !== "done") {
      // Update task to done
      updateTask(db, existingTask.id, { state: "done" });
    }
  }
}
```

#### 2. Updated Documentation (`docs/JIRA_TASK_AUTO_CREATION.md`)

**Added Sections:**
- "Automatic Task Status Sync" feature description
- "Status Sync Behavior" section explaining the complete flow
- Updated "Usage" section to include status sync step
- Marked "Automatic task state updates" as implemented in Future Enhancements
- Added status sync to testing checklist

**Status Flow Diagram:**
```
Jira: To Do → In Progress → Done
Task: (none) → inbox → done
```

#### 3. Created Test Scripts

**`test-jira-done-sync.ts`:**
- Tests specifically the "Done" status sync feature
- Fetches all "Done" Jira issues
- Verifies tasks are updated to "done" state
- Reports on tasks updated, already done, and not found

**`test-jira-full-sync.ts`:**
- Comprehensive test of both creation and status sync
- Simulates the complete polling logic
- Shows status breakdown of all issues
- Displays example Jira-linked tasks

## Features

### Automatic Status Sync
- **Trigger**: Runs during regular Jira polling (default: every 5 minutes)
- **Detection**: Checks for Jira issues with status "Done"
- **Action**: Updates corresponding task state to "done"
- **Smart Logic**: Only updates tasks that are not already "done"
- **Logging**: Logs each task update with issue key and task ID

### Benefits
1. **Automatic Completion**: No manual task updates needed
2. **Bi-directional Awareness**: Tasks reflect Jira status changes
3. **Efficient**: Only updates tasks that need updating
4. **Transparent**: Full logging of all status changes
5. **Non-destructive**: Preserves manual task state changes until Jira issue is done

## Configuration

No additional configuration needed! The feature works automatically when:
- `auto_create_tasks` is `true` (default)
- Jira connector is running and polling

To disable both creation and status sync:
```json
{
  "helpers": {
    "jira": {
      "auto_create_tasks": false
    }
  }
}
```

## Testing

### Manual Testing

1. **Test Status Sync Only:**
   ```bash
   bun test-jira-done-sync.ts
   ```

2. **Test Complete Sync (Creation + Status):**
   ```bash
   bun test-jira-full-sync.ts
   ```

### Expected Behavior

1. **New "In Progress" Issue:**
   - Task is created with state "inbox"
   - Task title: `{ISSUE_KEY}: {Summary}`
   - Task source: `jira:{ISSUE_KEY}`

2. **Issue Moved to "Done":**
   - Existing task is updated to state "done"
   - Log entry: `jira.task.updated_to_done`

3. **Already "Done" Task:**
   - No update performed (idempotent)
   - No log entry generated

## Technical Details

### Database Query
```typescript
const existingTask = db.query<{ id: string; state: string }, [string]>(
  "SELECT id, state FROM tasks WHERE source = ?"
).get(`jira:${issue.key}`);
```

### Update Logic
```typescript
if (issue.status === "Done" && existingTask && existingTask.state !== "done") {
  updateTask(db, existingTask.id, { state: "done" });
  tasksUpdatedToDone++;
  logger.info("jira.task.updated_to_done", {
    issue_key: issue.key,
    task_id: existingTask.id,
  });
}
```

### Logging
- **Event**: `jira.task.updated_to_done`
- **Data**: `{ issue_key, task_id }`
- **Summary**: `jira.poll.done` includes `tasks_updated_to_done` count

## Future Enhancements

Potential improvements:
- Support for other status transitions (e.g., "In Progress" → "open")
- Configurable status mappings
- Bi-directional sync (update Jira when task is completed)
- Webhook support for real-time updates
- Custom status transition rules

## Files Modified

1. `packages/connectors/jira/src/index.ts` - Core implementation
2. `docs/JIRA_TASK_AUTO_CREATION.md` - Documentation updates
3. `test-jira-done-sync.ts` - Status sync test (new)
4. `test-jira-full-sync.ts` - Complete sync test (new)

## Compatibility

- ✅ Works with existing task creation feature
- ✅ Respects `auto_create_tasks` configuration
- ✅ No breaking changes
- ✅ Backward compatible with existing tasks
- ✅ No database schema changes required

## Implementation Date

November 4, 2025
