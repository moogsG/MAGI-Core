# MCP Local Tasks

> **Local-first MCP server for managing development tasks from Slack and Microsoft 365**

A fast, private, token-lean task management system that runs locally and integrates with your existing tools through the Model Context Protocol (MCP).

## ✨ Features

- 🔒 **Local-first & Private** - All data stored locally in SQLite
- 🚀 **Fast** - Sub-100ms cached lists with FTS5 full-text search
- 🔌 **Extensible** - Pluggable connection helpers for Slack, Microsoft 365, and more
- 💡 **Token-lean** - Returns compact handles; expand on demand
- 🛠️ **MCP Protocol** - Standard stdio transport for AI assistants

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -w -r build

# Run tests
pnpm -w -r test

# Start MCP server
pnpm dev
```

## 🔧 MCP Tools

The server exposes these tools via the MCP protocol:

- **`task.create`** - Create a new task with title, body, priority, due date
- **`task.list`** - List tasks as compact handles with filtering and search
- **`task.expand`** - Get full task details by ID
- **`task.update`** - Update task fields (state, priority, etc.)

## 📦 Project Structure

```
packages/
  server/           # Main MCP server with SQLite storage
  connectors/
    template/       # Echo helper example for building connectors
docs/
  PROJECT_PLAN.md   # Full project specification
  helpers.md        # Guide for writing connection helpers
config.json         # Helper configuration
```

## 🧩 Extensibility

Add connection helpers by editing `config.json`:

```json
{
  "helpers": [
    {
      "name": "echo",
      "module": "./packages/connectors/template/dist/src/index.js",
      "config": { "greeting": "hi" }
    }
  ]
}
```

See `docs/helpers.md` for the helper authoring guide.

## 🧪 Testing

```bash
# Run all tests
pnpm -w -r test

# Run server tests only
pnpm --filter=@mcp/server test
```

Current test coverage:
- ✅ Task creation and listing
- ✅ Task expansion
- ✅ Task updates
- ✅ FTS keyword search

## 📚 Documentation

- [Project Plan](docs/PROJECT_PLAN.md) - Full specification and architecture
- [Helper Guide](docs/helpers.md) - How to write connection helpers
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - What's been built
- [Server Package](packages/server/README.md) - Server details
- [Connector Template](packages/connectors/template/README.md) - Example helper

## 🎯 Roadmap

- [ ] Slack connector (Socket Mode)
- [ ] Microsoft 365 connector (Outlook + Calendar)
- [ ] DuckDB analytics layer
- [ ] Qdrant vector search
- [ ] Markdown export with prompt suggestions
- [ ] CLI/TUI for local usage

## 🛠️ Development

Built with:
- **TypeScript** - Type-safe development
- **PNPM** - Fast, efficient package management
- **better-sqlite3** - High-performance SQLite
- **MCP SDK** - Model Context Protocol
- **Vitest** - Fast unit testing

## 📄 License

MIT

---

### Optional: Start Qdrant (for future vector search)

```bash
docker run -d \
  -p 6333:6333 \
  -v $(pwd)/data/qdrant_storage:/qdrant/storage \
  --name qdrant \
  qdrant/qdrant
```