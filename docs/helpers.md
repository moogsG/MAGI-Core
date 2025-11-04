# Writing a Connection Helper

Connection Helpers extend mcp-local-tasks with new tools and (optionally) background jobs.

## Steps

1. Implement and export a default `ConnectionHelper` from your package.
2. Add it to `config.json` under `"helpers"`.
3. The server will load, init, and (optionally) start your helper, then register its tools.

## Design Rules

- **Token-lean responses**: Return compact handles and add expansion tools.
- **Honor privacy**: Redact secrets and enforce allowlists.
- **Add metadata**: Include `as_of` timestamps and `source` labels to list results.
- **Handle rate limits**: Implement retries internally if you call external APIs.

## Interface

```typescript
export interface ConnectionHelper {
  name: string;
  version: string;
  init(ctx: HelperContext): Promise<void> | void;
  tools(): ToolDefinition[];
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export interface HelperContext {
  db: DB;
  logger: HelperLogger;
  config: Record<string, any>;
  emit?(event: string, payload?: unknown): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any> | any;
}
```

## Example

See `packages/connectors/template` for a minimal echo helper implementation.

## Versioning

- Keep `name` stable; bump `version` semver on changes.
- Document scopes and required env vars in the helper README.
