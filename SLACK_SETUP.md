# Slack App Setup Guide

## Required Scopes

Your Slack app needs the following **Bot Token Scopes**:

### For listing and reading channels:
- ✅ `channels:read` - View basic information about public channels
- ✅ `channels:history` - View messages in public channels
- ✅ `groups:read` - View basic information about private channels  
- ✅ `groups:history` - View messages in private channels

### For posting messages:
- ✅ `chat:write` - Send messages as the bot

### For permalinks:
- ✅ `links:read` - View URLs in messages (for permalink generation)

## Setup Steps

1. **Go to your Slack App settings**: https://api.slack.com/apps
2. Click on your app
3. Go to **OAuth & Permissions** in the left sidebar
4. Scroll down to **Scopes** → **Bot Token Scopes**
5. Click **Add an OAuth Scope** and add each of the scopes listed above
6. Scroll to the top and click **Reinstall to Workspace**
7. Copy the new **Bot User OAuth Token** (starts with `xoxb-`)
8. Update your `.env` file with the new token

## Enable Socket Mode

1. Go to **Socket Mode** in the left sidebar
2. Toggle **Enable Socket Mode** to ON
3. Click **Generate an app-level token**
4. Name it "socket-token" and add the `connections:write` scope
5. Copy the token (starts with `xapp-`)
6. Update your `.env` file with this token

## Invite Bot to Channels

After setup, invite your bot to the channels you want to monitor:

```
/invite @your-bot-name
```

## Test Again

Once you've added the scopes and reinstalled the app, run the test again:

```bash
bun test-slack-simple.ts
```

## Current Status

Based on the test output:
- ✅ Socket Mode connection: **Working**
- ✅ Connector initialization: **Working**
- ✅ MCP tools registered: **Working**
- ❌ Missing scope: `channels:read` (and possibly others)

Add the scopes listed above and reinstall the app to fix this!
