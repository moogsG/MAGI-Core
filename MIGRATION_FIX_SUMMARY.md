# Migration Fix Summary

## Problem
You were getting an error: **"no such column: priority"**

This happened because the database migration was only applied to `packages/server/tasks.db` but not to `data/tasks.db`, which is the database your server is actually using.

## Solution Applied

### 1. Created Universal Migration Script
Created `migrate-slack-priority.ts` that:
- Automatically finds ALL `.db` files in the project
- Checks each one for `slack_messages` table
- Adds `priority` column if missing
- Creates the priority index
- Reports what was migrated

### 2. Applied Migration
Ran the migration script and successfully updated:
- ✅ `packages/server/tasks.db` (already had it)
- ✅ `data/tasks.db` (newly migrated)

### 3. Updated Documentation
- Updated `SLACK_PRIORITY_QUICKSTART.md` to include migration step
- Added troubleshooting section to `docs/SLACK_PRIORITY_FEATURE.md`
- Created this summary document

## How to Use

### If You Get "no such column: priority" Error

Run this from the project root:

```bash
bun migrate-slack-priority.ts
```

You'll see output like:
```
🔍 Searching for databases with slack_messages table...

📁 data/tasks.db
  ⚙️  Adding priority column...
  ✅ Added priority column
  ✅ Created priority index

============================================================
Migration Summary:
  Migrated: 1
  Already migrated: 1
  Skipped (no slack_messages): 3
============================================================

✅ Migration complete! Restart your server to use the new priority feature.
```

Then restart your server and the error will be gone!

## Verification

To verify the migration worked:

```bash
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('data/tasks.db');
const cols = db.query('PRAGMA table_info(slack_messages)').all();
const hasPriority = cols.some(c => c.name === 'priority');
console.log('Has priority column:', hasPriority ? '✅ YES' : '❌ NO');
db.close();
"
```

Should output: `Has priority column: ✅ YES`

## Files Created/Modified

1. **migrate-slack-priority.ts** (NEW) - Universal migration script
2. **SLACK_PRIORITY_QUICKSTART.md** (UPDATED) - Added migration step
3. **docs/SLACK_PRIORITY_FEATURE.md** (UPDATED) - Added troubleshooting
4. **MIGRATION_FIX_SUMMARY.md** (NEW) - This file

## Next Steps

1. ✅ Migration is complete
2. ✅ All databases are updated
3. 🔄 Restart your server
4. ✅ Error should be resolved!

The priority feature is now ready to use. Follow the rest of the steps in `SLACK_PRIORITY_QUICKSTART.md` to configure your user ID and start using priority filtering.
