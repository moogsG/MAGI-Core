// Microsoft Graph API types
export interface OutlookMessage {
  id: string;
  receivedDateTime: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  subject: string;
  bodyPreview: string;
  webLink: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
  };
  webLink: string;
}

// Database row types
export interface OutlookMessageRow {
  id: string;
  received_at: string;
  sender: string;
  subject: string;
  preview: string;
  web_link: string;
  folder: string;
  created_ts: string;
}

export interface CalendarEventRow {
  id: string;
  start: string;
  end: string;
  subject: string;
  location: string | null;
  web_link: string;
  created_ts: string;
}

// Compact handle types for token-lean responses
export interface OutlookMessageHandle {
  id: string;
  received_at: string;
  from: string;
  subject: string;
  preview: string;
  link: string;
  as_of: string;
  source: string;
  approx_freshness_seconds: number;
}

export interface CalendarEventHandle {
  id: string;
  start: string;
  end: string;
  subject: string;
  location?: string;
  link: string;
  as_of: string;
  source: string;
  approx_freshness_seconds: number;
}

// OAuth token storage
export interface TokenStore {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // Unix timestamp
  scope: string;
}

// Config interface
export interface MsConfig {
  poll_minutes?: number; // 2-10 minutes
  client_id?: string;
  tenant_id?: string;
}
