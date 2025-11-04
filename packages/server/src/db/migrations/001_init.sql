-- Core domain tables
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  state TEXT CHECK(state IN ('inbox','open','done')) NOT NULL DEFAULT 'inbox',
  priority TEXT CHECK(priority IN ('low','med','high')) NOT NULL DEFAULT 'med',
  estimate_min INTEGER,
  due_ts TEXT,
  source TEXT,
  summary TEXT,
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  kind TEXT,
  url TEXT,
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  kind TEXT,
  at_ts TEXT NOT NULL,
  payload_json TEXT
);

-- Optional FTS mirror for keyword search within this package
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, body, summary);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_tasks_recent ON tasks (created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks (state, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_ts ASC);
