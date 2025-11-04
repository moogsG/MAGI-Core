export interface SlackMessage {
  id: string;
  channel_id: string;
  ts: string;
  user: string | null;
  text: string | null;
  thread_ts: string | null;
  edited_at: string | null;
  deleted: number;
  permalink: string | null;
  created_ts: string;
}

export interface SlackMessageHandle {
  id: string;
  ts: string;
  uid: string | null;
  preview: string;
  link: string | null;
  as_of: string;
  source: string;
  approx_freshness_seconds: number;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  is_member: boolean;
  is_archived: boolean;
}

export interface PermalinkQueueItem {
  channel_id: string;
  ts: string;
  message_id: string;
  attempts: number;
  next_retry_at: string;
}
