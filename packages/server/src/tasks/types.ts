export type TaskState = "inbox" | "open" | "done";
export type TaskPriority = "low" | "med" | "high";

export interface Task {
  id: string;
  title: string;
  body?: string | null;
  state: TaskState;
  priority: TaskPriority;
  estimate_min?: number | null;
  due_ts?: string | null;
  source?: string | null;
  summary?: string | null;
  created_ts: string;
  updated_ts: string;
}

export type TaskHandle = {
  id: string;
  t: string;  // title
  p: string;  // preview (<=300 chars)
  s: TaskState;
  d?: string | null; // due date
};
