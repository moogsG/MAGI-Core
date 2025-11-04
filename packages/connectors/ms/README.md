# Microsoft Outlook/Calendar Connector

A connection helper for integrating Microsoft Outlook email and Calendar with mcp-local-tasks.

## Features

- **Device Code OAuth Flow**: Secure authentication using Microsoft's device code flow
- **Email Management**: List inbox messages and send emails
- **Calendar Integration**: View today's calendar events
- **Automatic Polling**: Background sync every 2-10 minutes (configurable)
- **Token-Lean Responses**: Compact handles with metadata for efficient token usage

## Required Scopes

- `Mail.Read` - Read user's email
- `Mail.Send` - Send email on behalf of user
- `Calendars.Read` - Read user's calendar events
- `offline_access` - Maintain access when user is offline

## Setup

### 1. Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations** > **New registration**
3. Set application name (e.g., "MAGI Tasks Connector")
4. Select **Accounts in any organizational directory and personal Microsoft accounts**
5. Click **Register**

### 2. Configure Application

1. Copy the **Application (client) ID** - you'll need this as `MS_CLIENT_ID`
2. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
3. Add the following permissions:
   - `Mail.Read`
   - `Mail.Send`
   - `Calendars.Read`
   - `offline_access`
4. Click **Grant admin consent** (if you have admin rights)
5. Go to **Authentication** > **Add a platform** > **Mobile and desktop applications**
6. Check the box for `https://login.microsoftonline.com/common/oauth2/nativeclient`
7. Under **Advanced settings**, set **Allow public client flows** to **Yes**

### 3. Environment Variables

Create or update your `.env` file:

```bash
MS_CLIENT_ID=your-application-client-id
MS_TENANT_ID=common  # or your specific tenant ID
```

### 4. Add to config.json

Add the connector to your `config.json`:

```json
{
  "helpers": [
    {
      "package": "@mcp/connector-ms",
      "config": {
        "poll_minutes": 5,
        "client_id": "${MS_CLIENT_ID}",
        "tenant_id": "${MS_TENANT_ID}"
      }
    }
  ]
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `poll_minutes` | number | 5 | Polling interval (2-10 minutes) |
| `client_id` | string | - | Azure AD application client ID |
| `tenant_id` | string | "common" | Azure AD tenant ID |

## Tools

### outlook.list_inbox

List top 25 messages from Outlook inbox.

**Parameters:**
- `limit` (optional): Number of messages to return (1-100, default: 25)

**Returns:**
```json
{
  "as_of": "2025-01-01T12:00:00Z",
  "source": "outlook",
  "approx_freshness_seconds": 120,
  "items": [
    {
      "id": "msg-id",
      "received_at": "2025-01-01T11:30:00Z",
      "from": "sender@example.com",
      "subject": "Meeting Tomorrow",
      "preview": "Hi, just confirming our meeting...",
      "link": "https://outlook.office.com/mail/...",
      "as_of": "2025-01-01T12:00:00Z",
      "source": "outlook",
      "approx_freshness_seconds": 120
    }
  ]
}
```

### outlook.send_mail

Send an email via Outlook.

**Parameters:**
- `to` (required): Array of recipient email addresses
- `subject` (required): Email subject
- `body` (required): Email body content
- `body_type` (optional): "text" or "html" (default: "text")

**Returns:**
```json
{
  "ok": true,
  "message": "Email sent successfully"
}
```

### calendar.list_today

List today's calendar events.

**Returns:**
```json
{
  "as_of": "2025-01-01T12:00:00Z",
  "source": "calendar",
  "approx_freshness_seconds": 120,
  "items": [
    {
      "id": "event-id",
      "start": "2025-01-01T14:00:00Z",
      "end": "2025-01-01T15:00:00Z",
      "subject": "Team Standup",
      "location": "Conference Room A",
      "link": "https://outlook.office.com/calendar/...",
      "as_of": "2025-01-01T12:00:00Z",
      "source": "calendar",
      "approx_freshness_seconds": 120
    }
  ]
}
```

## Authentication Flow

On first start, the connector will display:

```
============================================================
🔐 Microsoft Authentication Required
============================================================

📱 Please visit: https://microsoft.com/devicelogin
🔑 Enter code: ABCD-EFGH

⏱️  Waiting for authentication...
============================================================
```

1. Open the URL in your browser
2. Enter the displayed code
3. Sign in with your Microsoft account
4. Grant the requested permissions
5. Return to the terminal - authentication will complete automatically

The connector will automatically refresh tokens as needed.

## Database Schema

The connector uses two tables:

### outlook_messages
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
```

### calendars
```sql
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

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run tests
bun test

# Type check
tsc --noEmit
```

## Troubleshooting

### Authentication fails
- Verify `MS_CLIENT_ID` is correct
- Ensure app has correct API permissions
- Check that "Allow public client flows" is enabled

### No messages/events appear
- Check polling interval in config
- Verify scopes are granted
- Check logs for API errors

### Token expired errors
- The connector should auto-refresh tokens
- If issues persist, restart the server to re-authenticate

## Version

0.1.0

## License

MIT
