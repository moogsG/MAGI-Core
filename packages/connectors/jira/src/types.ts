export interface JiraConfig {
  url: string; // Jira instance URL (e.g., https://your-domain.atlassian.net)
  email: string; // User email for authentication
  api_token: string; // API token for authentication
  user_account_id: string; // Jira account ID to filter issues assigned to this user
  poll_minutes?: number; // Polling interval in minutes (default: 5, range: 2-15)
  project_keys?: string[]; // Optional: filter by specific project keys (e.g., ["PROJ", "TEAM"])
  auto_create_tasks?: boolean; // Automatically create tasks for "In Progress" issues (default: true)
}

export interface JiraIssue {
  id: string; // Jira issue ID
  key: string; // Issue key (e.g., "PROJ-123")
  summary: string; // Issue title/summary
  description?: string; // Issue description
  status: string; // Current status (e.g., "To Do", "In Progress", "Done")
  priority?: string; // Priority (e.g., "High", "Medium", "Low")
  assignee?: string; // Assignee account ID
  assignee_display_name?: string; // Assignee display name
  reporter?: string; // Reporter account ID
  reporter_display_name?: string; // Reporter display name
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
  due_date?: string; // Due date (YYYY-MM-DD format)
  issue_type: string; // Issue type (e.g., "Task", "Bug", "Story")
  project_key: string; // Project key
  project_name: string; // Project name
  web_url: string; // Web URL to the issue
  labels?: string[]; // Issue labels
}

export interface JiraApiIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;
    status: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
    };
    created: string;
    updated: string;
    duedate?: string;
    issuetype: {
      name: string;
    };
    project: {
      key: string;
      name: string;
    };
    labels?: string[];
  };
}

export interface JiraSearchResponse {
  issues: JiraApiIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}
