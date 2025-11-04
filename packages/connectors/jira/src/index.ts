import { BaseHelper } from "../../../server/dist/src/connections/base.js";
import type { HelperContext, ToolDefinition } from "../../../server/dist/src/connections/types.js";
import { JiraClient } from "./client.js";
import { upsertJiraIssue, getJiraIssues, getJiraIssue } from "./repo.js";
import type { Database } from "bun:sqlite";
import type { JiraConfig, JiraIssue } from "./types.js";
import { createTask, updateTask } from "../../../server/dist/src/tasks/repo.js";
import type { TaskPriority } from "../../../server/dist/src/tasks/types.js";

/**
 * Map Jira priority to task priority
 */
function mapJiraPriorityToTaskPriority(jiraPriority?: string): TaskPriority {
  if (!jiraPriority) return "med";
  
  const priority = jiraPriority.toLowerCase();
  if (priority.includes("highest") || priority.includes("critical")) return "high";
  if (priority.includes("high")) return "high";
  if (priority.includes("low") || priority.includes("lowest")) return "low";
  return "med";
}

/**
 * Format task body with Jira issue context
 */
function formatTaskBody(issue: JiraIssue): string {
  const parts: string[] = [];
  
  parts.push(`**Jira Issue:** [${issue.key}](${issue.web_url})`);
  parts.push(`**Type:** ${issue.issue_type}`);
  parts.push(`**Project:** ${issue.project_name} (${issue.project_key})`);
  
  if (issue.priority) {
    parts.push(`**Priority:** ${issue.priority}`);
  }
  
  if (issue.due_date) {
    parts.push(`**Due Date:** ${issue.due_date}`);
  }
  
  if (issue.labels && issue.labels.length > 0) {
    parts.push(`**Labels:** ${issue.labels.join(", ")}`);
  }
  
  if (issue.description) {
    parts.push("");
    parts.push("**Description:**");
    parts.push(issue.description);
  }
  
  return parts.join("\n");
}

class JiraHelper extends BaseHelper {
  name = "jira";
  version = "0.1.0";

  private client!: JiraClient;
  private pollerInterval: Timer | null = null;
  private config!: JiraConfig;
  private db!: Database;

  init(ctx: HelperContext) {
    super.init(ctx);
    this.db = ctx.db as Database;
    this.config = ctx.config as JiraConfig;

    // Initialize Jira client
    this.client = new JiraClient({
      url: this.config.url || process.env.JIRA_URL || "",
      email: this.config.email || process.env.JIRA_EMAIL || "",
      api_token: this.config.api_token || process.env.JIRA_API_TOKEN || "",
      user_account_id: this.config.user_account_id || process.env.JIRA_USER_ACCOUNT_ID || "",
      poll_minutes: this.config.poll_minutes,
      project_keys: this.config.project_keys,
    });

    ctx.logger.info("jira.init", {
      url: this.config.url || process.env.JIRA_URL,
      user: this.config.user_account_id || process.env.JIRA_USER_ACCOUNT_ID,
      pollMinutes: this.config.poll_minutes ?? 5,
      projectKeys: this.config.project_keys,
    });
  }

  private async pollIssues() {
    try {
      this.ctx.logger.info("jira.poll.start");

      const userAccountId = this.config.user_account_id || process.env.JIRA_USER_ACCOUNT_ID;
      if (!userAccountId) {
        this.ctx.logger.error("jira.poll.error", {
          error: "user_account_id not configured",
        });
        return;
      }

      const issues = await this.client.getIssuesAssignedToUser(userAccountId, {
        maxResults: 100,
        projectKeys: this.config.project_keys,
      });

      let tasksCreated = 0;
      let tasksUpdatedToDone = 0;

      for (const issue of issues) {
        upsertJiraIssue(this.db, issue);

        // Auto-create tasks for "In Progress" issues if enabled
        const autoCreateTasks = this.config.auto_create_tasks ?? true;
        if (autoCreateTasks) {
          // Check if task already exists for this issue (using source field)
          const existingTask = this.db.query<{ id: string; state: string }, [string]>(
            "SELECT id, state FROM tasks WHERE source = ?"
          ).get(`jira:${issue.key}`);

          if (issue.status === "In Progress" && !existingTask) {
            // Create new task for "In Progress" issues
            const taskTitle = `${issue.key}: ${issue.summary}`;
            const taskBody = formatTaskBody(issue);
            const taskPriority = mapJiraPriorityToTaskPriority(issue.priority);

            createTask(this.db, {
              title: taskTitle,
              body: taskBody,
              priority: taskPriority,
              due_ts: issue.due_date ? `${issue.due_date}T23:59:59Z` : null,
              source: `jira:${issue.key}`,
            });

            tasksCreated++;

            this.ctx.logger.info("jira.task.created", {
              issue_key: issue.key,
              task_title: taskTitle,
            });
          } else if (issue.status === "Done" && existingTask && existingTask.state !== "done") {
            // Update existing task to "done" if Jira issue is "Done"
            updateTask(this.db, existingTask.id, { state: "done" });

            tasksUpdatedToDone++;

            this.ctx.logger.info("jira.task.updated_to_done", {
              issue_key: issue.key,
              task_id: existingTask.id,
            });
          }
        }
      }

      this.ctx.logger.info("jira.poll.done", {
        count: issues.length,
        tasks_created: tasksCreated,
        tasks_updated_to_done: tasksUpdatedToDone,
      });
    } catch (error: any) {
      this.ctx.logger.error("jira.poll.error", { error: error.message });
    }
  }

  tools(): ToolDefinition[] {
    return [
      {
        name: "jira.list_issues",
        description: "List Jira issues assigned to the configured user with compact handles. Supports filtering by status and project.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "array",
              items: { type: "string" },
              description: 'Filter by status (e.g., ["To Do", "In Progress"])',
            },
            project_keys: {
              type: "array",
              items: { type: "string" },
              description: 'Filter by project keys (e.g., ["PROJ", "TEAM"])',
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 50,
              description: "Maximum number of issues to return",
            },
          },
        },
        handler: async ({
          status,
          project_keys,
          limit = 50,
        }: {
          status?: string[];
          project_keys?: string[];
          limit?: number;
        }) => {
          try {
            const userAccountId = this.config.user_account_id || process.env.JIRA_USER_ACCOUNT_ID;
            
            const issues = getJiraIssues(this.db, {
              assignee: userAccountId,
              status,
              project_keys,
              limit,
            });

            return {
              as_of: new Date().toISOString(),
              source: "jira",
              approx_freshness_seconds: issues[0]?.approx_freshness_seconds ?? 0,
              count: issues.length,
              items: issues,
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      },
      {
        name: "jira.get_issue",
        description: "Get full details of a specific Jira issue by key or ID",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., 'PROJ-123') or ID",
            },
          },
          required: ["issue_key"],
        },
        handler: async ({ issue_key }: { issue_key: string }) => {
          try {
            const issue = getJiraIssue(this.db, issue_key);

            if (!issue) {
              return { error: `Issue not found: ${issue_key}` };
            }

            return {
              as_of: new Date().toISOString(),
              source: "jira",
              issue: {
                ...issue,
                labels: issue.labels ? JSON.parse(issue.labels) : [],
              },
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      },
      {
        name: "jira.add_comment",
        description: "Add a comment to a Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., 'PROJ-123')",
            },
            comment: {
              type: "string",
              description: "Comment text to add",
            },
          },
          required: ["issue_key", "comment"],
        },
        handler: async ({
          issue_key,
          comment,
        }: {
          issue_key: string;
          comment: string;
        }) => {
          try {
            await this.client.addComment(issue_key, comment);

            this.ctx.logger.info("jira.add-comment.success", {
              issue_key,
            });

            return {
              ok: true,
              message: `Comment added to ${issue_key}`,
            };
          } catch (error: any) {
            this.ctx.logger.error("jira.add-comment.error", {
              error: error.message,
            });
            return { ok: false, error: error.message };
          }
        },
      },
      {
        name: "jira.get_transitions",
        description: "Get available status transitions for a Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., 'PROJ-123')",
            },
          },
          required: ["issue_key"],
        },
        handler: async ({ issue_key }: { issue_key: string }) => {
          try {
            const transitions = await this.client.getTransitions(issue_key);

            return {
              as_of: new Date().toISOString(),
              source: "jira",
              issue_key,
              transitions: transitions.map((t) => ({
                id: t.id,
                name: t.name,
                to: t.to?.name,
              })),
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      },
      {
        name: "jira.transition_issue",
        description: "Transition a Jira issue to a new status",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Issue key (e.g., 'PROJ-123')",
            },
            transition_id: {
              type: "string",
              description: "Transition ID (get from jira.get_transitions)",
            },
          },
          required: ["issue_key", "transition_id"],
        },
        handler: async ({
          issue_key,
          transition_id,
        }: {
          issue_key: string;
          transition_id: string;
        }) => {
          try {
            await this.client.transitionIssue(issue_key, transition_id);

            this.ctx.logger.info("jira.transition.success", {
              issue_key,
              transition_id,
            });

            // Refresh the issue from API
            const updatedIssue = await this.client.getIssue(issue_key);
            upsertJiraIssue(this.db, updatedIssue);

            return {
              ok: true,
              message: `Issue ${issue_key} transitioned successfully`,
              new_status: updatedIssue.status,
            };
          } catch (error: any) {
            this.ctx.logger.error("jira.transition.error", {
              error: error.message,
            });
            return { ok: false, error: error.message };
          }
        },
      },
    ];
  }

  async start() {
    this.ctx.logger.info("jira.start");

    // Run initial poll
    await this.pollIssues().catch((err) => {
      this.ctx.logger.error("jira.poller.initial-error", { error: err });
    });

    // Start polling interval (default 5 minutes, configurable 2-15 minutes)
    const pollMinutes = Math.max(
      2,
      Math.min(15, this.config.poll_minutes ?? 5)
    );
    this.pollerInterval = setInterval(() => {
      this.pollIssues().catch((err) => {
        this.ctx.logger.error("jira.poller.error", { error: err });
      });
    }, pollMinutes * 60 * 1000);

    this.ctx.logger.info("jira.poller.scheduled", {
      intervalMinutes: pollMinutes,
    });
  }

  async stop() {
    this.ctx.logger.info("jira.stop");

    if (this.pollerInterval) {
      clearInterval(this.pollerInterval);
      this.pollerInterval = null;
    }
  }
}

export default new JiraHelper();
