export type GroupByOption = "day" | "week" | "month" | "state" | "priority";

export interface ExportMarkdownOptions {
  path?: string;
  groupBy?: GroupByOption;
  includePrompts?: boolean;
  filter?: {
    state?: Array<"inbox" | "open" | "done">;
    priority?: Array<"low" | "med" | "high">;
  };
}

export interface GroupedTasks {
  groupKey: string;
  groupLabel: string;
  tasks: TaskWithContext[];
}

export interface TaskWithContext {
  id: string;
  title: string;
  state: string;
  priority: string;
  due_ts: string | null;
  source: string | null;
  created_ts: string;
  context: string; // summary or preview from body
}

export interface PromptTemplate {
  label: string;
  template: (title: string) => string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: "🔍 Investigate",
    template: (title: string) => 
      `Find likely root causes and quick diagnostics for "${title}".`
  },
  {
    label: "📝 Summarize",
    template: (title: string) => 
      `Summarize prior context and links for "${title}" in 5 bullets.`
  },
  {
    label: "📋 Plan",
    template: (title: string) => 
      `Propose a step-by-step plan to complete "${title}".`
  },
  {
    label: "🧪 Test",
    template: (title: string) => 
      `List test cases and edge conditions for "${title}".`
  }
];
