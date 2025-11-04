# Environment-Based Configuration Migration

## Summary

MAGI-Core now uses environment variables as the primary configuration source, with `config.json` serving only to define which connectors to load and their module paths.

## What Changed

### 1. Configuration System

**Before:**
- Configuration values were hardcoded in `config.json`
- Secrets and settings mixed together
- Difficult to change settings per environment

**After:**
- `config.json` defines connector modules only
- All configuration values come from `.env`
- Environment variables override any defaults in `config.json`
- Secrets stay out of version control

### 2. New Files

- **`packages/server/src/connections/config-loader.ts`** - Merges env vars into config
- **`ENV_CONFIG_MIGRATION.md`** - This migration guide

### 3. Updated Files

- **`config.json`** - Simplified to empty config objects
- **`sample.env`** - Added all connector configuration variables
- **`packages/server/src/index.ts`** - Uses new config loader
- **`packages/server/src/slack-daemon.ts`** - Uses new config loader
- **`README.md`** - Updated configuration documentation
- **`docs/config.md`** - Complete rewrite with env-first approach
- **`docs/quickstart.md`** - Added Slack configuration example

## New Environment Variables

### Slack Connector

```bash
SLACK_ALLOWED_CHANNELS=#channel1,#channel2  # Comma-separated channel list
SLACK_USER_ID=U123456789                    # User ID for priority detection
SLACK_SWEEPER_MINUTES=10                    # Background sweep interval
SLACK_ENABLE_TODO_DETECTION=true            # Auto-create tasks from TODO: messages
SLACK_ENABLE_BACKGROUND_SERVICES=true       # Enable Socket Mode and sweeper
```

### Echo/Template Connector

```bash
ECHO_GREETING=Hello!                        # Greeting message
```

### Microsoft 365 Connector

```bash
MS_POLL_MINUTES=5                           # Polling interval
MS_MAIL_FOLDERS=Inbox,Important             # Comma-separated folder list
```

## Migration Guide

### For Existing Installations

1. **Backup your current `config.json`:**
   ```bash
   cp config.json config.json.backup
   ```

2. **Copy sample.env to .env:**
   ```bash
   cp sample.env .env
   ```

3. **Transfer settings from config.json to .env:**
   
   If your `config.json` had:
   ```json
   {
     "helpers": [{
       "name": "slack",
       "config": {
         "allow_channels": ["#dev", "#ai"],
         "user": "U123456789",
         "sweeper_minutes": 15
       }
     }]
   }
   ```
   
   Add to `.env`:
   ```bash
   SLACK_ALLOWED_CHANNELS=#dev,#ai
   SLACK_USER_ID=U123456789
   SLACK_SWEEPER_MINUTES=15
   ```

4. **Simplify config.json:**
   ```json
   {
     "helpers": [{
       "name": "slack",
       "module": "./packages/connectors/slack/dist/index.js",
       "config": {}
     }]
   }
   ```

5. **Rebuild and test:**
   ```bash
   bun run build
   bun run dev
   ```

### For New Installations

1. **Copy sample.env:**
   ```bash
   cp sample.env .env
   ```

2. **Edit .env with your settings:**
   - Add Slack tokens and configuration
   - Configure other connectors as needed

3. **config.json is ready to use** (no changes needed)

## Benefits

✅ **Security**: Secrets stay in `.env` (gitignored)  
✅ **Flexibility**: Easy to change settings per environment  
✅ **Simplicity**: One source of truth for configuration  
✅ **Compatibility**: Existing config.json still works (env vars override)  
✅ **Best Practices**: Follows 12-factor app methodology  

## Configuration Precedence

Configuration is loaded in this order (later overrides earlier):

1. `config.json` defaults
2. System environment variables
3. `.env` file (auto-loaded by Bun)
4. Command-line overrides

Example:
```bash
# config.json has: sweeper_minutes: 10
# .env has: SLACK_SWEEPER_MINUTES=15
# Command line:
SLACK_SWEEPER_MINUTES=20 bun run dev

# Result: sweeper_minutes = 20
```

## Testing

The configuration system has been tested with:

✅ Environment variable parsing (strings, numbers, booleans, arrays)  
✅ Config merging (env vars override config.json)  
✅ Multiple connectors (Slack, Echo, MS)  
✅ Empty config objects in config.json  
✅ Integration with actual config.json  

## Documentation

See these updated docs for more information:

- **[Configuration Guide](docs/config.md)** - Complete reference
- **[Quickstart Guide](docs/quickstart.md)** - Getting started
- **[README.md](README.md)** - Overview and examples
- **[sample.env](sample.env)** - All available variables

## Support

If you encounter issues:

1. Check that `.env` exists and has correct values
2. Verify environment variable names match exactly (case-sensitive)
3. Check logs for "Loaded config.json with env overrides" message
4. See [Configuration Guide](docs/config.md) for troubleshooting

## Rollback

To rollback to the old system:

1. Restore your backup: `cp config.json.backup config.json`
2. Checkout previous version: `git checkout HEAD~1`
3. Rebuild: `bun run build`

Note: The new system is backward compatible - old config.json files with values in the `config` object still work.
