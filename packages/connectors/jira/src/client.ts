import type { JiraConfig, JiraSearchResponse, JiraApiIssue, JiraIssue } from "./types.js";

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.url.replace(/\/$/, ""); // Remove trailing slash
    
    // Create Basic Auth header (email:api_token encoded in base64)
    const credentials = `${config.email}:${config.api_token}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  /**
   * Make a request to the Jira API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": this.authHeader,
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search for issues using JQL (Jira Query Language)
   */
  async searchIssues(jql: string, maxResults = 50): Promise<JiraSearchResponse> {
    const body = {
      jql,
      maxResults,
      fields: [
        "summary",
        "description",
        "status",
        "priority",
        "assignee",
        "reporter",
        "created",
        "updated",
        "duedate",
        "issuetype",
        "project",
        "labels",
      ],
    };

    return this.request<JiraSearchResponse>(`/search/jql`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Get issues assigned to a specific user
   */
  async getIssuesAssignedToUser(
    accountId: string,
    options: {
      maxResults?: number;
      projectKeys?: string[];
      statuses?: string[];
    } = {}
  ): Promise<JiraIssue[]> {
    const { maxResults = 50, projectKeys, statuses } = options;

    // Build JQL query
    let jql = `assignee = "${accountId}"`;

    if (projectKeys && projectKeys.length > 0) {
      const projectFilter = projectKeys.map((key) => `"${key}"`).join(",");
      jql += ` AND project IN (${projectFilter})`;
    }

    if (statuses && statuses.length > 0) {
      const statusFilter = statuses.map((s) => `"${s}"`).join(",");
      jql += ` AND status IN (${statusFilter})`;
    }

    jql += " ORDER BY updated DESC";

    const response = await this.searchIssues(jql, maxResults);
    return response.issues.map((issue) => this.transformIssue(issue));
  }

  /**
   * Get a single issue by key or ID
   */
  async getIssue(issueIdOrKey: string): Promise<JiraIssue> {
    const issue = await this.request<JiraApiIssue>(`/issue/${issueIdOrKey}`);
    return this.transformIssue(issue);
  }

  /**
   * Transform Jira API issue to our internal format
   */
  private transformIssue(apiIssue: JiraApiIssue): JiraIssue {
    const fields = apiIssue.fields;
    
    // Extract plain text from description (Jira uses ADF format)
    let description: string | undefined;
    if (fields.description) {
      if (typeof fields.description === "string") {
        description = fields.description;
      } else if (fields.description.content) {
        // ADF format - extract text from content nodes
        description = this.extractTextFromADF(fields.description);
      }
    }

    return {
      id: apiIssue.id,
      key: apiIssue.key,
      summary: fields.summary,
      description,
      status: fields.status.name,
      priority: fields.priority?.name,
      assignee: fields.assignee?.accountId,
      assignee_display_name: fields.assignee?.displayName,
      reporter: fields.reporter?.accountId,
      reporter_display_name: fields.reporter?.displayName,
      created: fields.created,
      updated: fields.updated,
      due_date: fields.duedate,
      issue_type: fields.issuetype.name,
      project_key: fields.project.key,
      project_name: fields.project.name,
      web_url: `${this.baseUrl}/browse/${apiIssue.key}`,
      labels: fields.labels,
    };
  }

  /**
   * Extract plain text from Jira's ADF (Atlassian Document Format)
   */
  private extractTextFromADF(adf: any): string {
    if (!adf || !adf.content) return "";

    const extractText = (node: any): string => {
      if (node.type === "text") {
        return node.text || "";
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join(" ");
      }

      return "";
    };

    return adf.content.map(extractText).join("\n").trim();
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string, comment: string): Promise<void> {
    await this.request(`/issue/${issueIdOrKey}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: comment,
                },
              ],
            },
          ],
        },
      }),
    });
  }

  /**
   * Update issue status (transition)
   */
  async transitionIssue(
    issueIdOrKey: string,
    transitionId: string
  ): Promise<void> {
    await this.request(`/issue/${issueIdOrKey}/transitions`, {
      method: "POST",
      body: JSON.stringify({
        transition: {
          id: transitionId,
        },
      }),
    });
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueIdOrKey: string): Promise<any[]> {
    const response = await this.request<{ transitions: any[] }>(
      `/issue/${issueIdOrKey}/transitions`
    );
    return response.transitions;
  }
}
