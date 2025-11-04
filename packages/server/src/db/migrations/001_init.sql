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
  kind TEXT CHECK(kind IN ('slack','mail','pr','doc')) NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  kind TEXT CHECK(kind IN ('capture','update','complete','ingest')) NOT NULL,
  at_ts TEXT NOT NULL,
  payload_json TEXT,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS slack_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  user TEXT,
  text TEXT,
  thread_ts TEXT,
  edited_at TEXT,
  deleted INTEGER DEFAULT 0,
  permalink TEXT,
  created_ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outlook_messages (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  preview TEXT,
  web_link TEXT,
  folder TEXT,
  created_ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  subject TEXT,
  location TEXT,
  web_link TEXT,
  created_ts TEXT NOT NULL
);

-- FTS5 virtual table for keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(title, body, summary, content='tasks', content_rowid='rowid');

-- FTS5 triggers to keep tasks_fts in sync
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, body, summary) VALUES (new.rowid, new.title, new.body, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, body, summary) VALUES('delete', old.rowid, old.title, old.body, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, body, summary) VALUES('delete', old.rowid, old.title, old.body, old.summary);
  INSERT INTO tasks_fts(rowid, title, body, summary) VALUES (new.rowid, new.title, new.body, new.summary);
END;

-- Indexes for recency queries
CREATE INDEX IF NOT EXISTS idx_tasks_recent ON tasks (created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks (state, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_ts ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks (updated_ts DESC);

CREATE INDEX IF NOT EXISTS idx_links_task ON links (task_id);
CREATE INDEX IF NOT EXISTS idx_events_task ON events (task_id);
CREATE INDEX IF NOT EXISTS idx_events_recent ON events (at_ts DESC);

CREATE INDEX IF NOT EXISTS idx_slack_recent ON slack_messages (created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_slack_channel ON slack_messages (channel_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_slack_thread ON slack_messages (thread_ts);

CREATE INDEX IF NOT EXISTS idx_outlook_recent ON outlook_messages (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_outlook_folder ON outlook_messages (folder, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendars_start ON calendars (start ASC);
CREATE INDEX IF NOT EXISTS idx_calendars_range ON calendars (start ASC, end ASC);
