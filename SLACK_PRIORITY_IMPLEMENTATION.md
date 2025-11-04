# Slack Priority Feature - Implementation Summary

## Overview

Successfully implemented priority detection and filtering for the Slack connector. Messages that mention or reply to a configured user are automatically marked as priority, and TODO detection now only creates tasks for messages from that user.

## Changes Made

### 1. Configuration Schema (Step 1)
- **File**: `packages/connectors/slack/src/index.ts`
- Added `user?: string` field to `SlackConfig` interface
- User ID is used to identify priority messages

### 2. Type Definitions (Step 1)
- **File**: `packages/connectors/slack/src/types.ts`
- Added `priority: number` to `SlackMessage` interface
- Added `priority: boolean` to `SlackMessageHandle` interface

### 3. Database Schema (Step 2)
- **Migration**: Added `priority INTEGER DEFAULT 0` column to `slack_messages` table
- **Index**: Created `idx_slack_priority` for efficient priority-based queries
- **Location**: `packages/server/tasks.db`

### 4. Priority Detection Logic (Step 3)
- **File**: `packages/connectors/slack/src/index.ts`
- Added `isPriorityMessage()` method that detects:
  - Messages from the configured user
  - Messages mentioning the configured user (`<@U01234ABCDE>`)
  - Messages replying to threads started by the configured user
- Updated `setupMessageListeners()` to call priority detection for all messages
- Updated `runSweeper()` to set priority when fetching historical messages

### 5. TODO Filtering (Step 4)
- **File**: `packages/connectors/slack/src/index.ts`
- Modified `createTodoTask()` to accept `userId` parameter
- Added filtering logic: only creates tasks if message is from configured user
- Added logging for skipped TODOs with reason

### 6. Repository Functions (Step 6)
- **File**: `packages/connectors/slack/src/repo.ts`
- Updated `upsertSlackMessage()` to accept and store `priority` field
- Updated `getSlackMessagesByChannel()` to:
  - Accept `priorityOnly` parameter
  - Include `priority` in SELECT query
  - Sort by priority DESC, then timestamp
  - Return priority flag in handles
- Updated `getRecentMessages()` with same priority support
- Updated `getMessagesByDateRange()` to:
  - Accept `priorityOnly` parameter
  - Filter by priority when requested
  - Sort by priority DESC

### 7. MCP Tools (Step 5)
- **File**: `packages/connectors/slack/src/index.ts`
- Updated `slack.get_history` tool:
  - Added `priority_only` boolean parameter
  - Updated description to mention priority filtering
  - Returns `priority_filter` in response
- Updated `slack.summarize_messages` tool:
  - Added `priority_only` boolean parameter
  - Updated description to mention priority filtering
  - Returns `priority_filter` in response

### 8. Documentation
- **File**: `docs/SLACK_PRIORITY_FEATURE.md` (NEW)
  - Comprehensive guide to priority feature
  - Configuration examples
  - Use cases and best practices
  - Troubleshooting guide
- **File**: `docs/connectors.md` (UPDATED)
  - Added priority detection section
  - Updated configuration example
  - Added link to detailed documentation

## Testing

Created and ran test script to verify:
- ✅ Priority messages are correctly marked (priority = 1)
- ✅ Normal messages have priority = 0
- ✅ Messages mentioning user are marked as priority
- ✅ Priority filtering works in queries
- ✅ Database schema is correct

## Database Migration

Applied migration to `packages/server/tasks.db`:
```sql
ALTER TABLE slack_messages ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX idx_slack_priority ON slack_messages (priority DESC, created_ts DESC);
```

Verified:
- ✅ Column added successfully
- ✅ Index created successfully
- ✅ Existing messages default to priority = 0

## Build Status

- ✅ TypeScript compilation successful
- ✅ No type errors
- ✅ All files properly updated

## Usage Example

### Configuration
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

### MCP Tool Usage
```typescript
// Get only priority messages
slack.get_history({
  channel_id: "C01234567",
  priority_only: true,
  limit: 20
})

// Get all messages with priority info
slack.get_history({
  channel_id: "C01234567",
  limit: 50
})
// Returns items with priority: true/false flag
```

### TODO Detection
```
You (U01234ABCDE): "TODO: Fix the bug"     → Task created ✓
Teammate: "TODO: Update docs"              → Ignored (logged)
```

## Logging

New log entries:
- `slack.message.new` - Now includes `priority: true/false`
- `slack.message.updated` - Now includes `priority: true/false`
- `slack.todo.created` - Now includes `userId`
- `slack.todo.skipped` - NEW: Logs when TODO is skipped with reason

## Breaking Changes

None. All changes are backward compatible:
- Priority defaults to 0 for existing messages
- `priority_only` parameter is optional (defaults to false)
- Tools work without `user` configured (priority always 0)

## Future Enhancements

Potential improvements:
1. Add priority levels (high/medium/low) instead of binary
2. Support multiple priority users
3. Add priority-based notifications
4. Create priority-based task queues
5. Add analytics for priority message patterns

## Files Modified

1. `packages/connectors/slack/src/index.ts` - Main connector logic
2. `packages/connectors/slack/src/types.ts` - Type definitions
3. `packages/connectors/slack/src/repo.ts` - Database operations
4. `docs/SLACK_PRIORITY_FEATURE.md` - New documentation
5. `docs/connectors.md` - Updated documentation
6. `packages/server/tasks.db` - Database schema (migrated)

## Verification Steps

To verify the implementation:

1. **Build**: `cd packages/connectors/slack && bun run build`
2. **Check schema**: Query `PRAGMA table_info(slack_messages)` 
3. **Test priority**: Send messages and check priority field
4. **Test TODO**: Send TODO from different users, verify filtering
5. **Test tools**: Call MCP tools with `priority_only: true`

## Completion Status

✅ Step 1: Update Configuration Schema - COMPLETE
✅ Step 2: Enhance Database Schema - COMPLETE  
✅ Step 3: Update Message Processing Logic - COMPLETE
✅ Step 4: Filter TODO Detection - COMPLETE
✅ Step 5: Update MCP Tools - COMPLETE
✅ Step 6: Update Repository Functions - COMPLETE
✅ Documentation - COMPLETE
✅ Testing - COMPLETE
✅ Build Verification - COMPLETE

**Implementation is complete and ready for use!**
