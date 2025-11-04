# Configuration Guide

Complete reference for MAGI-Core environment variables and configuration files.

## Configuration Files

MAGI-Core uses two configuration files:

1. **`.env`** - Environment variables (secrets, paths, settings)
2. **`config.json`** - Helper/connector configuration (non-secret)

## Environment Variables

All environment variables are optional unless marked **Required**.

### Core Server Settings

#### TASKS_DB_PATH

Path to SQLite database file.

- **Type:** String (file path)
- **Default:** `./data/tasks.db`
- **Example:** `./data/tasks.db` or `/absolute/path/to/tasks.db`

```bash
TASKS_DB_PATH=./data/tasks.db
```

#### MIGRATIONS_PATH

Directory containing SQL migration files.

- **Type:** String (directory path)
- **Default:** `./packages/server/src/db/migrations`
- **Example:** `./custom/migrations`

```bash
MIGRATIONS_PATH=./packages/server/src/db/migrations
```

#### MARKDOWN_PATH

Default path for markdown exports.

- **Type:** String (file path)
- **Default:** `./tasks.md`
- **Example:** `./exports/tasks.md`

```bash
MARKDOWN_PATH=./tasks.md
```

#### NODE_ENV

Environment mode.

- **Type:** String
- **Values:** `development`, `production`, `test`
- **Default:** `development`

```bash
NODE_ENV=development
```

#### LOG_LEVEL

Logging verbosity.

- **Type:** String
- **Values:** `debug`, `info`, `warn`, `error`
- **Default:** `info`

```bash
LOG_LEVEL=info
```

#### MCP_TRANSPORT

MCP server transport mode.

- **Type:** String
- **Values:** `stdio`, `http`
- **Default:** `stdio`

```bash
MCP_TRANSPORT=stdio
```

#### MCP_PORT

Port for HTTP transport (only used when `MCP_TRANSPORT=http`).

- **Type:** Number
- **Default:** `3000`
- **Example:** `3000`, `8080`

```bash
MCP_PORT=3000
```

### SQLite Settings

#### SQLITE_PRAGMA_JOURNAL_MODE

SQLite journal mode.

- **Type:** String
- **Values:** `DELETE`, `TRUNCATE`, `PERSIST`, `MEMORY`, `WAL`, `OFF`
- **Default:** `WAL`
- **Recommended:** `WAL` (Write-Ahead Logging for performance)

```bash
SQLITE_PRAGMA_JOURNAL_MODE=WAL
```

#### SQLITE_PRAGMA_SYNCHRONOUS

SQLite synchronous mode.

- **Type:** Number
- **Values:** `0` (OFF), `1` (NORMAL), `2` (FULL), `3` (EXTRA)
- **Default:** `2`
- **Recommended:** `2` (FULL) for safety, `1` (NORMAL) for performance

```bash
SQLITE_PRAGMA_SYNCHRONOUS=2
```

### DuckDB Settings

#### DUCKDB_PATH

Path to DuckDB analytical database.

- **Type:** String (file path)
- **Default:** `./data/analytics.duckdb`

```bash
DUCKDB_PATH=./data/analytics.duckdb
```

#### DUCKDB_SNAPSHOT_PATH

Directory for Parquet snapshot exports.

- **Type:** String (directory path)
- **Default:** `./data/snapshots`

```bash
DUCKDB_SNAPSHOT_PATH=./data/snapshots
```

#### DUCKDB_REFRESH_INTERVAL_MIN

How often to refresh DuckDB snapshot from SQLite (minutes).

- **Type:** Number
- **Default:** `30`
- **Range:** `1` - `1440` (1 min to 24 hours)

```bash
DUCKDB_REFRESH_INTERVAL_MIN=30
```

### Qdrant (Vector Search) Settings

#### QDRANT_ENABLED

Enable/disable vector search layer.

- **Type:** Boolean
- **Values:** `true`, `false`
- **Default:** `true`

```bash
QDRANT_ENABLED=true
```

#### QDRANT_HOST

Qdrant server hostname.

- **Type:** String
- **Default:** `127.0.0.1`
- **Example:** `localhost`, `qdrant.example.com`

```bash
QDRANT_HOST=127.0.0.1
```

#### QDRANT_PORT

Qdrant server port.

- **Type:** Number
- **Default:** `6333`

```bash
QDRANT_PORT=6333
```

#### QDRANT_COLLECTION

Qdrant collection name for embeddings.

- **Type:** String
- **Default:** `tasks_vec`

```bash
QDRANT_COLLECTION=tasks_vec
```

#### QDRANT_VECTOR_DIM

Dimensionality of vector embeddings.

- **Type:** Number
- **Default:** `1536` (OpenAI text-embedding-3-small)
- **Example:** `1536`, `768`, `384`

```bash
QDRANT_VECTOR_DIM=1536
```

#### QDRANT_API_KEY

API key for Qdrant Cloud (optional for local Docker).

- **Type:** String
- **Default:** *(empty)*

```bash
QDRANT_API_KEY=your-api-key-here
```

### Slack Connector Settings

#### SLACK_APP_TOKEN

**Required** for Slack integration. App-level token for Socket Mode.

- **Type:** String
- **Format:** `xapp-*`
- **Example:** `xapp-1-A012B3C4D5E6-1234567890123-abc...`

```bash
SLACK_APP_TOKEN=xapp-1-A012B3C4D5E6-1234567890123-abc...
```

#### SLACK_BOT_TOKEN

**Required** for Slack integration. Bot user OAuth token.

- **Type:** String
- **Format:** `xoxb-*`
- **Example:** `xoxb-1234567890123-1234567890123-abc...`

```bash
SLACK_BOT_TOKEN=xoxb-1234567890123-1234567890123-abc...
```

#### SLACK_SIGNING_SECRET

Slack signing secret for request verification (optional).

- **Type:** String
- **Example:** `abc123def456...`

```bash
SLACK_SIGNING_SECRET=abc123def456...
```

#### SLACK_ALLOWED_CHANNELS

Comma-separated list of allowed channels.

- **Type:** String (comma-separated)
- **Format:** `#channel-name` or `C0123456789`
- **Example:** `#dev,#ai,#support`

```bash
SLACK_ALLOWED_CHANNELS=#dev,#ai,#support
```

#### SLACK_SWEEPER_MINUTES

Background sweep interval for channels (minutes).

- **Type:** Number
- **Default:** `10`
- **Range:** `5` - `60`

```bash
SLACK_SWEEPER_MINUTES=10
```

### Microsoft 365 Connector Settings

#### MS_CLIENT_ID

**Required** for Microsoft 365 integration. Azure AD application client ID.

- **Type:** String (GUID)
- **Example:** `12345678-1234-1234-1234-123456789abc`

```bash
MS_CLIENT_ID=12345678-1234-1234-1234-123456789abc
```

#### MS_TENANT_ID

Azure AD tenant ID.

- **Type:** String (GUID or "common")
- **Default:** `common`
- **Example:** `common`, `abcdef12-3456-7890-abcd-ef1234567890`

```bash
MS_TENANT_ID=common
```

#### MS_CLIENT_SECRET

Azure AD client secret (optional; uses device code flow if not provided).

- **Type:** String
- **Default:** *(empty)*

```bash
MS_CLIENT_SECRET=your-secret-here
```

#### MS_POLL_MINUTES

Polling interval for inbox and calendar (minutes).

- **Type:** Number
- **Default:** `5`
- **Range:** `2` - `60`

```bash
MS_POLL_MINUTES=5
```

#### MS_MAIL_FOLDERS

Comma-separated list of mail folders to sync.

- **Type:** String (comma-separated)
- **Default:** `Inbox,Important`
- **Example:** `Inbox`, `Inbox,Sent,Drafts`

```bash
MS_MAIL_FOLDERS=Inbox,Important
```

### Embedding Settings

#### EMBEDDING_PROVIDER

Embedding provider.

- **Type:** String
- **Values:** `openai`, `local`, `none`
- **Default:** `openai`

```bash
EMBEDDING_PROVIDER=openai
```

#### EMBEDDING_MODEL

Model name for embedding generation.

- **Type:** String
- **Default:** `text-embedding-3-small`
- **Example:** `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`

```bash
EMBEDDING_MODEL=text-embedding-3-small
```

#### OPENAI_API_KEY

OpenAI API key for embeddings.

- **Type:** String
- **Format:** `sk-*`
- **Example:** `sk-proj-abc123...`

```bash
OPENAI_API_KEY=sk-proj-abc123...
```

### Developer / Diagnostics Settings

#### DEBUG_MCP

Enable debug logging for MCP protocol.

- **Type:** Boolean
- **Values:** `true`, `false`
- **Default:** `false`

```bash
DEBUG_MCP=false
```

#### LOG_DB_QUERIES

Enable query logging for SQLite and DuckDB.

- **Type:** Boolean
- **Values:** `true`, `false`
- **Default:** `false`

```bash
LOG_DB_QUERIES=false
```

#### MAX_CONCURRENT_JOBS

Maximum concurrent background jobs.

- **Type:** Number
- **Default:** `4`
- **Range:** `1` - `16`

```bash
MAX_CONCURRENT_JOBS=4
```

#### TMP_PATH

Temporary directory for exports and batch processing.

- **Type:** String (directory path)
- **Default:** `./tmp`

```bash
TMP_PATH=./tmp
```

## config.json Format

The `config.json` file configures connection helpers (connectors).

### Structure

```json
{
  "helpers": [
    {
      "name": "string",
      "module": "string",
      "config": {}
    }
  ]
}
```

### Fields

#### name

Unique identifier for the helper.

- **Type:** String
- **Required:** Yes
- **Example:** `"slack"`, `"outlook"`, `"github"`

#### module

Path to the helper module (relative or absolute).

- **Type:** String
- **Required:** Yes
- **Example:** `"./packages/connectors/slack/dist/index.js"`

#### config

Helper-specific configuration object.

- **Type:** Object
- **Required:** No
- **Default:** `{}`

### Example Configuration

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "allow_channels": ["#dev", "#ai", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true
      }
    },
    {
      "name": "outlook",
      "module": "./packages/connectors/ms/dist/index.js",
      "config": {
        "poll_minutes": 5,
        "mail_folders": ["Inbox", "Important"]
      }
    },
    {
      "name": "echo",
      "module": "./packages/connectors/template/dist/src/index.js",
      "config": {
        "greeting": "Hello from MAGI-Core!"
      }
    }
  ]
}
```

## Connector-Specific Configuration

### Slack Connector

```json
{
  "name": "slack",
  "module": "./packages/connectors/slack/dist/index.js",
  "config": {
    "allow_channels": ["#dev", "#ai"],
    "sweeper_minutes": 10,
    "enable_todo_detection": true
  }
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allow_channels` | string[] | `[]` | Allowed channels (names or IDs) |
| `sweeper_minutes` | number | `10` | Background sweep interval (5-60) |
| `enable_todo_detection` | boolean | `false` | Auto-create tasks from TODO: messages |

### Microsoft 365 Connector

```json
{
  "name": "outlook",
  "module": "./packages/connectors/ms/dist/index.js",
  "config": {
    "poll_minutes": 5,
    "mail_folders": ["Inbox", "Important"]
  }
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `poll_minutes` | number | `5` | Polling interval (2-60) |
| `mail_folders` | string[] | `["Inbox"]` | Mail folders to sync |

### Template Connector

```json
{
  "name": "echo",
  "module": "./packages/connectors/template/dist/src/index.js",
  "config": {
    "greeting": "Hello!"
  }
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `greeting` | string | `"hi"` | Greeting message |

## Configuration Profiles

### Development

Optimized for local development with verbose logging:

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_MCP=true
LOG_DB_QUERIES=true
SQLITE_PRAGMA_SYNCHRONOUS=1
QDRANT_ENABLED=false
```

### Production

Optimized for production with safety and performance:

```bash
NODE_ENV=production
LOG_LEVEL=info
DEBUG_MCP=false
LOG_DB_QUERIES=false
SQLITE_PRAGMA_JOURNAL_MODE=WAL
SQLITE_PRAGMA_SYNCHRONOUS=2
QDRANT_ENABLED=true
```

### Testing

Optimized for automated tests:

```bash
NODE_ENV=test
LOG_LEVEL=warn
TASKS_DB_PATH=:memory:
QDRANT_ENABLED=false
```

### Minimal

Minimal configuration (just tasks, no connectors):

```bash
TASKS_DB_PATH=./data/tasks.db
MARKDOWN_PATH=./tasks.md
NODE_ENV=development
```

### Full Features

All features enabled:

```bash
# Core
TASKS_DB_PATH=./data/tasks.db
MARKDOWN_PATH=./tasks.md
NODE_ENV=production
LOG_LEVEL=info

# SQLite
SQLITE_PRAGMA_JOURNAL_MODE=WAL
SQLITE_PRAGMA_SYNCHRONOUS=2

# DuckDB
DUCKDB_PATH=./data/analytics.duckdb
DUCKDB_SNAPSHOT_PATH=./data/snapshots
DUCKDB_REFRESH_INTERVAL_MIN=30

# Qdrant
QDRANT_ENABLED=true
QDRANT_HOST=127.0.0.1
QDRANT_PORT=6333
QDRANT_COLLECTION=tasks_vec
QDRANT_VECTOR_DIM=1536

# Embeddings
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-proj-...

# Slack
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
SLACK_ALLOWED_CHANNELS=#dev,#ai

# Microsoft 365
MS_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MS_TENANT_ID=common
MS_POLL_MINUTES=5
MS_MAIL_FOLDERS=Inbox,Important
```

## Environment Variable Precedence

MAGI-Core loads environment variables in this order (later overrides earlier):

1. **System environment** (shell exports)
2. **`.env` file** (in project root)
3. **Command-line overrides** (inline variables)

Example:

```bash
# System export
export TASKS_DB_PATH=/system/tasks.db

# .env file
TASKS_DB_PATH=./data/tasks.db

# Command-line override
TASKS_DB_PATH=/tmp/tasks.db bun run dev
```

Final value: `/tmp/tasks.db`

## Validation

MAGI-Core validates configuration on startup:

- **Required variables**: Checks presence of required env vars
- **Type checking**: Validates numbers, booleans, enums
- **Range validation**: Checks numeric ranges (e.g., ports)
- **File paths**: Warns on missing directories (doesn't create them)

Invalid configuration logs warnings but doesn't prevent startup (fails gracefully).

## Security Best Practices

### Secrets Management

**Never commit secrets to git:**

```bash
# .gitignore
.env
.env.*
config.local.json
*.key
*.pem
```

**Use environment-specific files:**

```bash
.env.development   # Development secrets
.env.production    # Production secrets
.env.test          # Test secrets
```

Load with:

```bash
cp .env.development .env
```

**Use secret management tools:**

- **1Password**: `op run --env-file=.env -- bun run dev`
- **AWS Secrets Manager**: Fetch at runtime
- **HashiCorp Vault**: Fetch at runtime

### File Permissions

Restrict access to configuration files:

```bash
chmod 600 .env
chmod 600 config.json
```

### Database Encryption

For sensitive data, use SQLite encryption:

```bash
# SQLCipher
TASKS_DB_PATH=./data/tasks.db
SQLITE_KEY=your-encryption-key
```

## Troubleshooting

### Variable not recognized

**Symptom:** Changes to `.env` not taking effect.

**Fix:**
1. Check `.env` file location (must be in project root)
2. Restart the server
3. Check for typos in variable names
4. Verify Bun is loading `.env` (Bun auto-loads by default)

### Invalid value errors

**Symptom:** Validation warnings on startup.

**Fix:**
1. Check value type (string, number, boolean)
2. Verify enum values (e.g., `development`, not `dev`)
3. Check numeric ranges
4. Quote strings if they contain spaces

### Path not found errors

**Symptom:** `ENOENT: no such file or directory`

**Fix:**
1. Create missing directories:
   ```bash
   mkdir -p data snapshots tmp
   ```
2. Use absolute paths:
   ```bash
   TASKS_DB_PATH=/absolute/path/to/tasks.db
   ```
3. Check file permissions

### Connector not loading

**Symptom:** Helper not registered in MCP tools.

**Fix:**
1. Verify `module` path in `config.json`
2. Build the connector: `cd packages/connectors/<name> && bun run build`
3. Check for errors in server logs
4. Verify all required env vars are set

## See Also

- [Quickstart Guide](./quickstart.md) - Initial setup
- [Connectors Guide](./connectors.md) - Connector configuration
- [Sample Environment](../sample.env) - Full example `.env`
- [Config Example](../config.json) - Full example `config.json`
