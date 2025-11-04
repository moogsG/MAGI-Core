# Jira Connector for MAGI-Core

Connect your Jira instance to MAGI-Core for seamless issue tracking and management.

## Features

- 🔄 **Automatic Polling**: Fetches issues assigned to you at configurable intervals (2-15 minutes)
- 🎯 **User-Specific Filtering**: Only syncs issues assigned to the configured user
- 📊 **Project Filtering**: Optional filtering by specific project keys
- 💬 **Comment Support**: Add comments to issues directly from MCP tools
- 🔄 **Status Transitions**: Change issue status through available transitions
- 🗄️ **Local Storage**: Issues stored in SQLite for fast access and offline availability
- 🔍 **Flexible Querying**: Filter by status, project, and more

## Prerequisites

1. **Jira Cloud Account**: You need access to a Jira Cloud instance
2. **API Token**: Generate an API token from your Atlassian account
3. **Account ID**: Your Jira account ID for filtering assigned issues

## Setup

### 1. Generate Jira API Token

1. Go to [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a label (e.g., "MAGI-Core")
4. Copy the generated token (you won't be able to see it again!)

### 2. Find Your Account ID

**Method 1: From Jira Profile**
1. Go to your Jira instance (e.g., `https://your-domain.atlassian.net`)
2. Click your profile picture → **Profile**
3. Look at the URL: `https://your-domain.atlassian.net/jira/people/{ACCOUNT_ID}`
4. Copy the account ID from the URL

**Method 2: From API**
```bash
curl -u your-email@example.com:your-api-token \
  https://your-domain.atlassian.net/rest/api/3/myself
```
Look for the `accountId` field in the response.

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# Jira instance URL
JIRA_URL=https://your-domain.atlassian.net

# Your Jira email
JIRA_EMAIL=your-email@example.com

# API token from step 1
JIRA_API_TOKEN=your-api-token-here

# Your account ID from step 2
JIRA_USER_ACCOUNT_ID=your-account-id-here

# Optional: Polling interval (default: 5 minutes)
JIRA_POLL_MINUTES=5
```

### 4. Configure in config.json

Add the Jira connector to your `config.json`:

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
- `poll_minutes` (optional): Polling interval in minutes (default: 5, range: 2-15)
- `project_keys` (optional): Array of project keys to filter (e.g., `["PROJ", "TEAM"]`). Leave empty for all projects.

## MCP Tools

### jira.list_issues

List Jira issues assigned to the configured user.

**Parameters:**
- `status` (array, optional): Filter by status (e.g., `["To Do", "In Progress"]`)
- `project_keys` (array, optional): Filter by project keys (e.g., `["PROJ", "TEAM"]`)
- `limit` (number, optional): Maximum issues to return (default: 50, max: 100)

**Example:**
```json
{
  "status": ["In Progress", "To Do"],
  "project_keys": ["PROJ"],
  "limit": 20
}
```

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

### jira.get_issue

Get full details of a specific Jira issue.

**Parameters:**
- `issue_key` (string, required): Issue key (e.g., "PROJ-123") or ID

**Example:**
```json
{
  "issue_key": "PROJ-123"
}
```

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "jira",
  "issue": {
    "id": "10001",
    "key": "PROJ-123",
    "summary": "Implement new feature",
    "description": "Full description text...",
    "status": "In Progress",
    "priority": "High",
    "assignee": "account-id-here",
    "assignee_display_name": "John Doe",
    "reporter": "reporter-account-id",
    "reporter_display_name": "Jane Smith",
    "created": "2025-11-01T10:00:00Z",
    "updated": "2025-11-04T11:30:00Z",
    "due_date": "2025-11-10",
    "issue_type": "Task",
    "project_key": "PROJ",
    "project_name": "Project Name",
    "web_url": "https://your-domain.atlassian.net/browse/PROJ-123",
    "labels": ["backend", "api"]
  }
}
```

### jira.add_comment

Add a comment to a Jira issue.

**Parameters:**
- `issue_key` (string, required): Issue key (e.g., "PROJ-123")
- `comment` (string, required): Comment text to add

**Example:**
```json
{
  "issue_key": "PROJ-123",
  "comment": "Updated the implementation based on feedback"
}
```

**Returns:**
```json
{
  "ok": true,
  "message": "Comment added to PROJ-123"
}
```

### jira.get_transitions

Get available status transitions for an issue.

**Parameters:**
- `issue_key` (string, required): Issue key (e.g., "PROJ-123")

**Example:**
```json
{
  "issue_key": "PROJ-123"
}
```

**Returns:**
```json
{
  "as_of": "2025-11-04T12:00:00Z",
  "source": "jira",
  "issue_key": "PROJ-123",
  "transitions": [
    {
      "id": "21",
      "name": "Done",
      "to": "Done"
    },
    {
      "id": "31",
      "name": "In Review",
      "to": "In Review"
    }
  ]
}
```

### jira.transition_issue

Transition an issue to a new status.

**Parameters:**
- `issue_key` (string, required): Issue key (e.g., "PROJ-123")
- `transition_id` (string, required): Transition ID from `jira.get_transitions`

**Example:**
```json
{
  "issue_key": "PROJ-123",
  "transition_id": "21"
}
```

**Returns:**
```json
{
  "ok": true,
  "message": "Issue PROJ-123 transitioned successfully",
  "new_status": "Done"
}
```

## Database Schema

Issues are stored in the `jira_issues` table:

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
```

## Troubleshooting

### Authentication Errors

**Error:** `401 Unauthorized`

**Fix:**
1. Verify your email and API token are correct
2. Make sure the API token hasn't expired
3. Check that you're using the correct Jira URL

### No Issues Returned

**Check:**
1. Verify your account ID is correct
2. Make sure you have issues assigned to you in Jira
3. Check project key filters in `config.json`
4. Look at server logs for polling errors

### Rate Limiting

Jira Cloud has rate limits:
- **Standard**: 10 requests per second per user
- **Premium**: Higher limits available

If you hit rate limits:
1. Increase `poll_minutes` in config
2. Reduce the number of issues fetched
3. Check for other applications using the same API token

## Privacy & Security

- **Local Storage**: All issue data is stored locally in SQLite
- **API Token**: Never commit your API token to version control
- **Credentials**: Store credentials in `.env` file (not tracked by git)
- **Data Sync**: Only issues assigned to the configured user are synced

## Development

### Build

```bash
cd packages/connectors/jira
bun install
bun run build
```

### Test

```bash
bun test
```

## License

Part of MAGI-Core project.
