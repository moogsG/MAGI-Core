# Connectors Guide

Connection helpers integrate external data sources (Slack, Microsoft 365, Jira, etc.) with MAGI-Core.

## Overview

Connectors are pluggable modules that:
- Poll or listen to external data sources
- Store messages/events in local SQLite
- Register MCP tools for listing and posting
- Respect allowlists and rate limits

## Architecture

```
External Service → Connector → SQLite → MCP Tools → AI Assistant
```

Each connector:
1. Authenticates with the service
2. Fetches/listens for new data
3. Stores in service-specific tables
4. Provides MCP tools for access

## Slack Connector

### Features

- Real-time message ingestion via Socket Mode
- Permalink hydration with rate-limit-aware queue
- Background sweeper for allowlisted channels (5-15 min intervals)
- Optional TODO detection for auto-creating tasks

### Required Scopes

Your Slack app needs these **Bot Token Scopes**:

#### Reading channels:
- `channels:read` - View basic information about public channels
- `channels:history` - View messages in public channels
- `groups:read` - View basic information about private channels
- `groups:history` - View messages in private channels

#### Posting messages:
- `chat:write` - Send messages as the bot

#### Permalinks:
- `links:read` - View URLs in messages (for permalink generation)

### Setup Steps

1. **Create Slack App**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name it (e.g., "MAGI Tasks Bot")
   - Select your workspace

2. **Add Bot Token Scopes**
   - Go to **OAuth & Permissions**
   - Scroll to **Scopes** → **Bot Token Scopes**
   - Add all scopes listed above

3. **Enable Socket Mode**
   - Go to **Socket Mode** in sidebar
   - Toggle **Enable Socket Mode** to ON
   - Click **Generate an app-level token**
   - Name it "socket-token"
   - Add scope: `connections:write`
   - Copy the token (starts with `xapp-`)

4. **Install to Workspace**
   - Go to **OAuth & Permissions**
   - Click **Install to Workspace**
   - Authorize the app
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`)

5. **Invite Bot to Channels**
   ```
   /invite @your-bot-name
   ```
   Do this in each channel you want to monitor.

### Configuration

Add to `.env`:

```bash
SLACK_APP_TOKEN=xapp-1-A012...
SLACK_BOT_TOKEN=xoxb-012...
SLACK_SIGNING_SECRET=abc123...
SLACK_ALLOWED_CHANNELS=#dev,#ai,#support
SLACK_SWEEPER_MINUTES=10
```

Add to `config.json`:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "allow_channels": ["#dev", "#ai", "#support"],
        "sweeper_minutes": 10,
        "enable_todo_detection": true,
        "user": "U01234ABCDE"
      }
    }
  ]
}
```

**New: Priority Detection**

Set `user` to your Slack user ID to enable priority detection:
- Messages from you, mentioning you, or replying to your threads are marked as priority
- TODO detection only creates tasks for messages from the configured user
- MCP tools support `priority_only` filtering

See [Slack Priority Feature](./SLACK_PRIORITY_FEATURE.md) for details.

### Allowlist Configuration

The `allow_channels` array controls which channels are:
- Swept in background polls
- Available for TODO detection

**Formats:**
- Channel name: `#dev`, `#general`
- Channel ID: `C0123456789`

**Examples:**

```json
{
  "allow_channels": ["#dev", "#ai"]
}
```

Only messages from `#dev` and `#ai` are ingested.

```json
{
  "allow_channels": ["C0123456789", "C9876543210"]
}
```

Use channel IDs for precision (find ID in Slack → right-click channel → Copy Link).

### MCP Tools

#### slack.list_channels

List available Slack channels.

**Parameters:** None

**Returns:**
```json
{
  "channels": [
    {
      "id": "C0123456789",
      "name": "dev",
      "is_member": true,
      "topic": "Development discussion"
    }
  ]
}
```

#### slack.get_history

Get message history with handles.

**Parameters:**
- `channel` (string, required): Channel ID or name
- `limit` (number, optional): Max messages to return (default: 20)

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "slack",
  "approx_freshness_seconds": 120,
  "items": [
    {
      "id": "msg_123",
      "ts": "1699104000.123456",
      "uid": "U012ABC",
      "preview": "Fixed the authentication bug...",
      "link": "https://workspace.slack.com/archives/C012/p1699104000123456",
      "as_of": "2025-11-04T12:00:00Z",
      "source": "slack",
      "approx_freshness_seconds": 120
    }
  ]
}
```

#### slack.post_message

Post message to channel.

**Parameters:**
- `channel` (string, required): Channel ID or name
- `text` (string, required): Message text

**Returns:**
```json
{
  "ok": true,
  "ts": "1699104000.123456"
}
```

### Database Schema

```sql
CREATE TABLE slack_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  user TEXT,
  text TEXT,
  thread_ts TEXT,
  edited_at TEXT,
  deleted INTEGER DEFAULT 0,
  permalink TEXT,
  created_ts TEXT NOT NULL
);

CREATE INDEX idx_slack_channel_ts ON slack_messages(channel_id, ts);
```

### Rate Limiting

Permalink hydration respects Slack's rate limits:
- Tier 3: 50+ requests per minute
- Automatic retry with exponential backoff
- Queue-based processing to avoid bursts

### Privacy

- Messages are stored locally in SQLite
- No data sent to external services (except Slack API)
- Previews are truncated to 300 chars
- Configure `allow_channels` to limit data ingestion

### TODO Detection

When `enable_todo_detection: true`, messages containing "TODO:" automatically create inbox tasks:

```
TODO: Review the PR before EOD
```

Creates task:
- Title: "Review the PR before EOD"
- State: inbox
- Source: slack
- Link: permalink to message

## Microsoft 365 Connector

### Features

- Device Code OAuth Flow for secure authentication
- Email management (list inbox, send emails)
- Calendar integration (today's events)
- Automatic polling (2-10 minute intervals)
- Token-lean responses with compact handles

### Required Scopes

Your Azure AD app needs these **Delegated permissions**:

- `Mail.Read` - Read user's email
- `Mail.Send` - Send email on behalf of user
- `Calendars.Read` - Read user's calendar events
- `offline_access` - Maintain access when user is offline

### Setup Steps

1. **Register Azure AD Application**
   - Go to https://portal.azure.com
   - Navigate to **Azure Active Directory** → **App registrations**
   - Click **New registration**
   - Name: "MAGI Tasks Connector"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Click **Register**

2. **Configure Application**
   - Copy the **Application (client) ID**
   - Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add all scopes listed above
   - Click **Grant admin consent** (if admin)

3. **Enable Public Client Flows**
   - Go to **Authentication** → **Add a platform** → **Mobile and desktop applications**
   - Check: `https://login.microsoftonline.com/common/oauth2/nativeclient`
   - Under **Advanced settings**, set **Allow public client flows** to **Yes**

### Configuration

Add to `.env`:

```bash
MS_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MS_TENANT_ID=common
MS_POLL_MINUTES=5
MS_MAIL_FOLDERS=Inbox,Important
```

Add to `config.json`:

```json
{
  "helpers": [
    {
      "name": "outlook",
      "module": "./packages/connectors/ms/dist/index.js",
      "config": {
        "poll_minutes": 5,
        "mail_folders": ["Inbox", "Important"]
      }
    }
  ]
}
```

### Allowlist Configuration

The `mail_folders` array controls which email folders are polled:

**Default folders:**
- `Inbox` - Primary inbox
- `Sent` - Sent items
- `Drafts` - Draft emails
- `Important` - Important/flagged emails

**Examples:**

```json
{
  "mail_folders": ["Inbox"]
}
```

Only poll primary inbox.

```json
{
  "mail_folders": ["Inbox", "Important", "Custom Folder"]
}
```

Poll multiple folders including a custom one.

### Authentication Flow

On first start:

```
============================================================
🔐 Microsoft Authentication Required
============================================================

📱 Please visit: https://microsoft.com/devicelogin
🔑 Enter code: ABCD-EFGH

⏱️  Waiting for authentication...
============================================================
```

1. Open URL in browser
2. Enter the displayed code
3. Sign in with Microsoft account
4. Grant permissions
5. Return to terminal (auth completes automatically)

Tokens are cached and auto-refreshed.

### MCP Tools

#### outlook.list_inbox

List inbox messages.

**Parameters:**
- `limit` (number, optional): Max messages (1-100, default: 25)

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "outlook",
  "approx_freshness_seconds": 300,
  "items": [
    {
      "id": "AAMk...",
      "received_at": "2025-11-04T11:30:00Z",
      "from": "sender@example.com",
      "subject": "Meeting Tomorrow",
      "preview": "Hi, just confirming our meeting...",
      "link": "https://outlook.office.com/mail/...",
      "as_of": "2025-11-04T12:00:00Z",
      "source": "outlook",
      "approx_freshness_seconds": 300
    }
  ]
}
```

#### outlook.send_mail

Send an email.

**Parameters:**
- `to` (array[string], required): Recipient email addresses
- `subject` (string, required): Email subject
- `body` (string, required): Email body
- `body_type` (string, optional): "text" or "html" (default: "text")

**Returns:**
```json
{
  "ok": true,
  "message": "Email sent successfully"
}
```

#### calendar.list_today

List today's calendar events.

**Parameters:** None

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "calendar",
  "approx_freshness_seconds": 300,
  "items": [
    {
      "id": "AAMk...",
      "start": "2025-11-04T14:00:00Z",
      "end": "2025-11-04T15:00:00Z",
      "subject": "Team Standup",
      "location": "Conference Room A",
      "link": "https://outlook.office.com/calendar/...",
      "as_of": "2025-11-04T12:00:00Z",
      "source": "calendar",
      "approx_freshness_seconds": 300
    }
  ]
}
```

### Database Schema

```sql
CREATE TABLE outlook_messages (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  preview TEXT,
  web_link TEXT,
  folder TEXT,
  created_ts TEXT NOT NULL
);

CREATE TABLE calendars (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  subject TEXT,
  location TEXT,
  web_link TEXT,
  created_ts TEXT NOT NULL
);
```

### Privacy

- Tokens stored locally (`.ms_tokens.json`)
- Email/calendar data stored in local SQLite
- No data sent to third parties
- Configure `mail_folders` to limit data ingestion

## Jira Connector

### Features

- Automatic polling of issues assigned to you (2-15 min intervals)
- Project-based filtering
- Status-based filtering
- Add comments to issues
- Transition issues between statuses
- Local SQLite storage for fast access

### Required Credentials

Your Jira Cloud account needs:
- **API Token** - Generate at https://id.atlassian.com/manage-profile/security/api-tokens
- **Account ID** - Your Jira user account ID
- **Email** - Your Jira account email

### Setup Steps

1. **Generate API Token**
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click **Create API token**
   - Give it a label (e.g., "MAGI-Core")
   - Copy the token

2. **Find Your Account ID**
   - Go to your Jira profile: `https://your-domain.atlassian.net/jira/people`
   - Look at the URL for your account ID
   - Or use API: `curl -u email:token https://your-domain.atlassian.net/rest/api/3/myself`

### Configuration

Add to `.env`:

```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token-here
JIRA_USER_ACCOUNT_ID=your-account-id-here
JIRA_POLL_MINUTES=5
```

Add to `config.json`:

```json
{
  "helpers": [
    {
      "name": "jira",
      "module": "./packages/connectors/jira/dist/index.js",
      "config": {
        "poll_minutes": 5,
        "project_keys": ["PROJ", "TEAM"]
      }
    }
  ]
}
```

**Configuration Options:**
- `poll_minutes` (optional): Polling interval (default: 5, range: 2-15)
- `project_keys` (optional): Filter by project keys (e.g., `["PROJ", "TEAM"]`)

### MCP Tools

#### jira.list_issues

List Jira issues assigned to you.

**Parameters:**
- `status` (array, optional): Filter by status
- `project_keys` (array, optional): Filter by projects
- `limit` (number, optional): Max issues (default: 50, max: 100)

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "jira",
  "count": 5,
  "items": [
    {
      "id": "10001",
      "key": "PROJ-123",
      "summary": "Implement new feature",
      "status": "In Progress",
      "priority": "High",
      "assignee": "John Doe",
      "issue_type": "Task",
      "project_key": "PROJ",
      "updated": "2025-11-04T11:30:00Z",
      "link": "https://your-domain.atlassian.net/browse/PROJ-123"
    }
  ]
}
```

#### jira.get_issue

Get full details of a specific issue.

**Parameters:**
- `issue_key` (string, required): Issue key (e.g., "PROJ-123")

**Returns:**
```json
{
  "issue": {
    "id": "10001",
    "key": "PROJ-123",
    "summary": "Implement new feature",
    "description": "Full description...",
    "status": "In Progress",
    "priority": "High",
    "labels": ["backend", "api"]
  }
}
```

#### jira.add_comment

Add a comment to an issue.

**Parameters:**
- `issue_key` (string, required): Issue key
- `comment` (string, required): Comment text

**Returns:**
```json
{
  "ok": true,
  "message": "Comment added to PROJ-123"
}
```

#### jira.get_transitions

Get available status transitions.

**Parameters:**
- `issue_key` (string, required): Issue key

**Returns:**
```json
{
  "transitions": [
    { "id": "21", "name": "Done", "to": "Done" }
  ]
}
```

#### jira.transition_issue

Transition issue to new status.

**Parameters:**
- `issue_key` (string, required): Issue key
- `transition_id` (string, required): Transition ID

**Returns:**
```json
{
  "ok": true,
  "message": "Issue PROJ-123 transitioned successfully",
  "new_status": "Done"
}
```

### Database Schema

```sql
CREATE TABLE jira_issues (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  priority TEXT,
  assignee TEXT,
  assignee_display_name TEXT,
  reporter TEXT,
  reporter_display_name TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  due_date TEXT,
  issue_type TEXT NOT NULL,
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL,
  web_url TEXT NOT NULL,
  labels TEXT,
  created_ts TEXT NOT NULL
);

CREATE INDEX idx_jira_assignee ON jira_issues (assignee);
CREATE INDEX idx_jira_status ON jira_issues (status);
CREATE INDEX idx_jira_project ON jira_issues (project_key);
CREATE INDEX idx_jira_updated ON jira_issues (updated DESC);
```

### Privacy

- API token stored in `.env` (not tracked by git)
- Issue data stored locally in SQLite
- No data sent to third parties
- Only issues assigned to you are synced

## Creating Custom Connectors

See the template connector for a minimal example:

```bash
cd packages/connectors/template
cat src/index.ts
```

### Connector Interface

```typescript
export interface ConnectionHelper {
  init(ctx: HelperContext): Promise<void>;
  register(server: Server): void;
}

export interface HelperContext {
  db: DB;
  logger: Logger;
  config: Record<string, any>;
  emit: (event: string, payload?: unknown) => void;
}
```

### Implementation Steps

1. **Create package structure:**
   ```
   packages/connectors/my-connector/
     src/
       index.ts      # Main entry point
       repo.ts       # Database operations
       types.ts      # Type definitions
     package.json
     tsconfig.json
   ```

2. **Implement ConnectionHelper:**
   ```typescript
   export default {
     async init(ctx: HelperContext) {
       // Initialize connection, start polling
     },
     register(server: Server) {
       // Register MCP tools
     }
   };
   ```

3. **Register MCP tools:**
   ```typescript
   server.setRequestHandler(ListToolsRequestSchema, async () => ({
     tools: [
       {
         name: "myservice.list",
         description: "List items from my service",
         inputSchema: { /* ... */ }
       }
     ]
   }));
   ```

4. **Handle tool calls:**
   ```typescript
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     const { name, arguments: args } = request.params;
     if (name === "myservice.list") {
       const items = getItems(ctx.db, args);
       return { content: [{ type: "text", text: JSON.stringify(items) }] };
     }
   });
   ```

5. **Build and configure:**
   ```bash
   bun run build
   ```

   Add to `config.json`:
   ```json
   {
     "helpers": [
       {
         "name": "myservice",
         "module": "./packages/connectors/my-connector/dist/index.js",
         "config": { /* ... */ }
       }
     ]
   }
   ```

### Best Practices

#### Token Usage

Return compact handles (≤ 600 tokens per list):

```typescript
{
  id: string;
  preview: string;  // ≤300 chars
  link: string | null;
  as_of: string;
  source: string;
  approx_freshness_seconds: number;
}
```

Expand full details on demand.

#### Privacy

- Store credentials in `.env`, not in code
- Redact sensitive data in previews
- Use allowlists to limit data ingestion
- Log minimal info, no secrets

#### Performance

- Use prepared statements for database queries
- Batch inserts for bulk data
- Index foreign keys and timestamp columns
- Cache frequently accessed data

#### Rate Limiting

- Respect service rate limits
- Use exponential backoff for retries
- Queue requests to avoid bursts
- Log rate limit hits for monitoring

#### Error Handling

- Catch and log all errors
- Return graceful error responses
- Retry transient failures
- Don't crash the server

### Example: GitHub Connector

```typescript
import type { ConnectionHelper, HelperContext } from "../types.js";
import { Octokit } from "@octokit/rest";

export default {
  async init(ctx: HelperContext) {
    const { db, logger, config } = ctx;
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    // Create table
    db.exec(`
      CREATE TABLE IF NOT EXISTS github_issues (
        id TEXT PRIMARY KEY,
        repo TEXT NOT NULL,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        state TEXT NOT NULL,
        url TEXT NOT NULL,
        created_ts TEXT NOT NULL
      )
    `);
    
    // Start polling
    setInterval(async () => {
      const repos = config.repos || [];
      for (const repo of repos) {
        const [owner, name] = repo.split("/");
        const { data } = await octokit.issues.listForRepo({ owner, repo: name });
        
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO github_issues (id, repo, number, title, state, url, created_ts)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const issue of data) {
          stmt.run(
            issue.id.toString(),
            repo,
            issue.number,
            issue.title,
            issue.state,
            issue.html_url,
            issue.created_at
          );
        }
      }
      
      logger.info("github: polled issues");
    }, (config.poll_minutes || 5) * 60 * 1000);
  },
  
  register(server: Server) {
    // Register MCP tools for listing issues, etc.
  }
} satisfies ConnectionHelper;
```

## Troubleshooting

### Slack: Missing Scopes Error

```
Error: missing_scope: channels:read
```

**Fix:**
1. Go to https://api.slack.com/apps → Your App → OAuth & Permissions
2. Add the missing scope under **Bot Token Scopes**
3. Click **Reinstall to Workspace**
4. Update `SLACK_BOT_TOKEN` in `.env` with new token

### Slack: Not Receiving Messages

**Check:**
1. Bot is invited to the channel: `/invite @bot-name`
2. Channel is in allowlist: Check `allow_channels` in `config.json`
3. Socket Mode is connected: Look for connection log in server output

### Microsoft: Authentication Fails

```
Error: invalid_client
```

**Fix:**
1. Verify `MS_CLIENT_ID` is correct
2. Check "Allow public client flows" is enabled in Azure portal
3. Try using `common` as `MS_TENANT_ID`

### Microsoft: No Emails Appear

**Check:**
1. Verify scopes are granted: Azure Portal → Your App → API Permissions
2. Check polling interval: Look for poll logs in server output
3. Verify folder names: Check `mail_folders` in config

### Connector Won't Start

**Check:**
1. Module path is correct in `config.json`
2. Connector is built: Run `bun run build` from connector directory
3. Dependencies are installed: Run `bun install`
4. Environment variables are set: Check `.env`

### High Token Usage

**Fix:**
1. Reduce list limits in queries
2. Return handles instead of full objects
3. Truncate previews to ≤300 chars
4. Paginate large result sets

## Reference

- [Slack API Documentation](https://api.slack.com/docs)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Helper Authoring Guide](./helpers.md)
