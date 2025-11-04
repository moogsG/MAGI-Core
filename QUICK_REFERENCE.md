# MAGI-Core Configuration Quick Reference

## 🚀 Quick Start

```bash
# 1. Copy sample environment
cp sample.env .env

# 2. Edit .env with your settings
nano .env  # or your preferred editor

# 3. Build and run
bun run build
bun run dev
```

## 📝 Essential Environment Variables

### Core Settings
```bash
TASKS_DB_PATH=./data/tasks.db
MARKDOWN_PATH=./tasks.md
NODE_ENV=development
```

### Slack Integration
```bash
# Required tokens (get from https://api.slack.com/apps)
SLACK_APP_TOKEN=xapp-1-...
SLACK_BOT_TOKEN=xoxb-...

# Configuration
SLACK_ALLOWED_CHANNELS=#dev,#ai,#support
SLACK_USER_ID=U123456789
SLACK_SWEEPER_MINUTES=10
SLACK_ENABLE_TODO_DETECTION=true
SLACK_ENABLE_BACKGROUND_SERVICES=true
```

## 🔧 Configuration Files

### config.json
Defines which connectors to load:
```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {}
    }
  ]
}
```

### .env
Contains all configuration values (secrets, settings):
```bash
SLACK_ALLOWED_CHANNELS=#dev,#ai
SLACK_USER_ID=U123456789
```

## 🎯 Common Scenarios

### MCP Mode (Tools Only)
```bash
SLACK_ENABLE_BACKGROUND_SERVICES=false
```

### Daemon Mode (Full Features)
```bash
SLACK_ENABLE_BACKGROUND_SERVICES=true
SLACK_SWEEPER_MINUTES=10
```

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
SLACK_SWEEPER_MINUTES=5
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
SLACK_SWEEPER_MINUTES=15
```

## 📋 All Slack Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SLACK_APP_TOKEN` | string | - | App token (xapp-*) |
| `SLACK_BOT_TOKEN` | string | - | Bot token (xoxb-*) |
| `SLACK_SIGNING_SECRET` | string | - | Signing secret |
| `SLACK_ALLOWED_CHANNELS` | string | "" | Comma-separated channels |
| `SLACK_USER_ID` | string | "" | User ID for priority |
| `SLACK_SWEEPER_MINUTES` | number | 10 | Sweep interval |
| `SLACK_ENABLE_TODO_DETECTION` | boolean | false | Auto-create tasks |
| `SLACK_ENABLE_BACKGROUND_SERVICES` | boolean | false | Enable daemon mode |

## 🔍 Troubleshooting

### Config not loading?
```bash
# Check .env exists
ls -la .env

# Check for typos (case-sensitive!)
grep SLACK_ .env

# Check logs
bun run dev 2>&1 | grep config
```

### Slack not connecting?
```bash
# Verify tokens are set
echo $SLACK_APP_TOKEN
echo $SLACK_BOT_TOKEN

# Check background services enabled
grep SLACK_ENABLE_BACKGROUND_SERVICES .env
```

### Changes not taking effect?
```bash
# Rebuild after config changes
bun run build

# Restart server
# (Ctrl+C then bun run dev)
```

## 📚 Full Documentation

- **[Configuration Guide](docs/config.md)** - Complete reference
- **[Migration Guide](ENV_CONFIG_MIGRATION.md)** - Upgrade from old config
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Technical details
- **[Quickstart](docs/quickstart.md)** - Getting started

## 💡 Pro Tips

1. **Never commit .env** - It's in .gitignore for a reason
2. **Use .env.example** - Share template, not secrets
3. **Environment-specific files** - .env.development, .env.production
4. **Command-line overrides** - `SLACK_SWEEPER_MINUTES=5 bun run dev`
5. **Check precedence** - Command line > .env > config.json

## 🆘 Need Help?

1. Check [Configuration Guide](docs/config.md)
2. Review [sample.env](sample.env) for examples
3. See [Migration Guide](ENV_CONFIG_MIGRATION.md) for common issues
4. Check logs for "Loaded config.json with env overrides"
