# Jira Connector Usage Guide

Quick reference for using the Jira connector in MAGI-Core.

## Quick Start

1. **Set up environment variables** in `.env`:
   ```bash
   JIRA_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-api-token
   JIRA_USER_ACCOUNT_ID=your-account-id
   ```

2. **Add to config.json**:
   ```json
   {
     "helpers": [
       {
         "name": "jira",
         "module": "./packages/connectors/jira/dist/index.js",
         "config": {
           "poll_minutes": 5
         }
       }
     ]
   }
   ```

3. **Start the server**:
   ```bash
   bun run packages/server/src/cli.ts
   ```

## Common Use Cases

### List All Your Issues

```typescript
// Get all issues assigned to you
const result = await callTool("jira.list_issues", {});
```

### Filter by Status

```typescript
// Get only "In Progress" issues
const result = await callTool("jira.list_issues", {
  status: ["In Progress"]
});

// Get issues that are not done
const result = await callTool("jira.list_issues", {
  status: ["To Do", "In Progress", "In Review"]
});
```

### Filter by Project

```typescript
// Get issues from specific projects
const result = await callTool("jira.list_issues", {
  project_keys: ["PROJ", "TEAM"],
  limit: 20
});
```

### Get Issue Details

```typescript
// Get full details of a specific issue
const result = await callTool("jira.get_issue", {
  issue_key: "PROJ-123"
});
```

### Add a Comment

```typescript
// Add a comment to an issue
const result = await callTool("jira.add_comment", {
  issue_key: "PROJ-123",
  comment: "Working on this now. Will have it done by EOD."
});
```

### Change Issue Status

```typescript
// First, get available transitions
const transitions = await callTool("jira.get_transitions", {
  issue_key: "PROJ-123"
});

// Then transition to a new status
const result = await callTool("jira.transition_issue", {
  issue_key: "PROJ-123",
  transition_id: "21" // ID from transitions list
});
```

## Workflow Examples

### Daily Standup Prep

```typescript
// Get all your active issues
const active = await callTool("jira.list_issues", {
  status: ["In Progress", "In Review"],
  limit: 10
});

// Get blocked issues
const blocked = await callTool("jira.list_issues", {
  status: ["Blocked"],
  limit: 5
});
```

### Sprint Planning

```typescript
// Get all unstarted issues
const todo = await callTool("jira.list_issues", {
  status: ["To Do", "Backlog"],
  limit: 50
});

// Filter by specific project
const projectIssues = await callTool("jira.list_issues", {
  project_keys: ["SPRINT"],
  status: ["To Do"],
  limit: 30
});
```

### Issue Triage

```typescript
// Get issue details
const issue = await callTool("jira.get_issue", {
  issue_key: "PROJ-123"
});

// Add triage comment
await callTool("jira.add_comment", {
  issue_key: "PROJ-123",
  comment: "Triaged: Moving to In Progress"
});

// Move to In Progress
const transitions = await callTool("jira.get_transitions", {
  issue_key: "PROJ-123"
});

const inProgressTransition = transitions.transitions.find(
  t => t.to === "In Progress"
);

await callTool("jira.transition_issue", {
  issue_key: "PROJ-123",
  transition_id: inProgressTransition.id
});
```

### Weekly Review

```typescript
// Get all completed issues this week
const completed = await callTool("jira.list_issues", {
  status: ["Done"],
  limit: 50
});

// Get overdue issues
const overdue = await callTool("jira.list_issues", {
  status: ["To Do", "In Progress"],
  limit: 50
});
// Filter by due_date in your application logic
```

## Configuration Tips

### Polling Frequency

- **Fast updates (2-3 min)**: Good for active development, but uses more API calls
- **Standard (5 min)**: Balanced approach, recommended for most users
- **Slow updates (10-15 min)**: Good for background monitoring, conserves API quota

```json
{
  "config": {
    "poll_minutes": 5
  }
}
```

### Project Filtering

Filter to specific projects to reduce noise and API usage:

```json
{
  "config": {
    "poll_minutes": 5,
    "project_keys": ["MYPROJ", "TEAM"]
  }
}
```

Leave empty to sync all projects:

```json
{
  "config": {
    "poll_minutes": 5,
    "project_keys": []
  }
}
```

## Best Practices

1. **Use Project Filters**: If you work on specific projects, configure `project_keys` to reduce API calls and storage

2. **Reasonable Polling**: Don't set `poll_minutes` too low (< 2) to avoid rate limits

3. **Status Filters**: Use status filters in queries to get relevant issues quickly

4. **Batch Operations**: When transitioning multiple issues, add a small delay between calls to avoid rate limits

5. **Comment Wisely**: Add meaningful comments that provide context for your team

## Troubleshooting

### Issues Not Appearing

1. Check that issues are assigned to your account ID
2. Verify project filters in config.json
3. Check server logs for polling errors
4. Ensure API token has correct permissions

### Slow Performance

1. Reduce `limit` in queries
2. Use more specific filters (status, project)
3. Increase `poll_minutes` to reduce background load

### Rate Limit Errors

1. Increase `poll_minutes` in config
2. Reduce number of manual API calls
3. Check for other apps using the same API token

## API Reference

See [README.md](./README.md) for complete API documentation.
