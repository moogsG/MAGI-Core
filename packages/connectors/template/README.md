# Connector Helper Template

This package shows how to add a new **Connection Helper** to the local MCP.

## Implement the interface

Export a default object that implements the `ConnectionHelper` contract:
- `name`, `version`
- `init(ctx)` — receive DB, logger, and helper-specific `config`
- `tools()` — return tool definitions (actions). Keep responses token-lean.
- `start()/stop()` — optional background lifecycle.

## Config

Add your helper to the project `config.json`:

```json
{
  "helpers": [
    { "name": "echo", "module": "@mcp/connector-template", "config": { "greeting": "hi" } }
  ]
}
```

## Tips

- Use *handles-first* payloads; add `expand` tools for large bodies.
- Include `as_of`, `source`, and `approx_freshness_seconds` when relevant.
- Redact secrets; enforce allowlists/denylists.

## Testing

- Unit test your tools.
- Seed scripts if you create tables.
- Aim for p95 < 200 ms for list operations on local data.
