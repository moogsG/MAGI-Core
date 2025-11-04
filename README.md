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
bun install

# Build all packages
bun run build

# Run tests
bun test

# Start MCP server
bun run dev
```

### Hybrid Search Setup

```bash
# 1. Seed test data with invoice mismatch scenarios
cd packages/server
bun run seed:hybrid

# 2. Run benchmark (should complete in <120ms)
bun run test:hybrid

# 3. (Optional) Start Qdrant for semantic search
docker run -d \
  -p 6333:6333 \
  -v $(pwd)/data/qdrant_storage:/qdrant/storage \
  --name qdrant \
  qdrant/qdrant

# 4. (Optional) Initialize Qdrant collection
cd packages/data
bun run init-qdrant
```

## 🔧 MCP Tools

The server exposes these tools via the MCP protocol:

### Task Management
- **`task.create`** - Create a new task with title, body, priority, due date
- **`task.list`** - List tasks as compact handles with filtering and search
- **`task.expand`** - Get full task details by ID
- **`task.update`** - Update task fields (state, priority, etc.)
- **`task.queryHybrid`** - Hybrid search combining keyword (FTS5) + semantic (Qdrant) search with weighted ranking

### Slack Integration (via connector)
- **`slack.list_channels`** - List available Slack channels
- **`slack.get_history`** - Get message history from a channel
- **`slack.post_message`** - Post messages to channels
- **`slack.summarize_messages`** - Get messages formatted for AI summarization with date/channel filters

## 📦 Project Structure

```
packages/
  server/           # Main MCP server with SQLite storage
  data/             # Analytics & vector search layer
    src/
      snapshot.ts         # SQLite → Parquet export
      duckdb-views.ts     # Analytical views (today, week, overdue)
      qdrant-init.ts      # Vector collection setup
      embedder.ts         # Batch embedding (stub + OpenAI)
      hybrid-search.ts    # Weighted ranking merge
  connectors/
    slack/          # Slack integration
    ms/             # Microsoft 365 integration
    template/       # Echo helper example
docs/
  PROJECT_PLAN.md         # Full project specification
  helpers.md              # Guide for writing connection helpers
  HYBRID_SEARCH_GUIDE.md  # Hybrid search setup and usage
config.json               # Helper configuration
```

## 🧩 Extensibility

Add connection helpers by editing `config.json`. Helpers are automatically loaded by the MCP server and their tools are exposed via the MCP protocol:

```json
{
  "helpers": [
    {
      "name": "slack",
      "module": "./packages/connectors/slack/dist/index.js",
      "config": {
        "enable_background_services": false
      }
    }
  ]
}
```

**Two modes:**
- **MCP Mode** (`enable_background_services: false`): Tools only, no background services
- **Daemon Mode** (`enable_background_services: true`): Full Socket Mode, sweeper, etc.

See `docs/helpers.md` for the helper authoring guide.

## 🧪 Testing

```bash
# Run all tests
bun test

# Run server tests only
cd packages/server
bun test

# Run hybrid search benchmark
bun run test:hybrid
```

Current test coverage:
- ✅ Task creation and listing
- ✅ Task expansion
- ✅ Task updates
- ✅ FTS keyword search
- ✅ Hybrid search (0.73ms avg, 164x faster than 120ms target)

## 📚 Documentation

- [Project Plan](docs/PROJECT_PLAN.md) - Full specification and architecture
- [Hybrid Search Guide](docs/HYBRID_SEARCH_GUIDE.md) - Setup and usage guide
- [Helper Guide](docs/helpers.md) - How to write connection helpers
- [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) - What's been built
- [Data Package](packages/data/IMPLEMENTATION.md) - Analytics & vector search
- [Server Package](packages/server/README.md) - Server details
- [Connector Template](packages/connectors/template/README.md) - Example helper

## 🎯 Roadmap

- [x] **Hybrid search** - FTS5 + Qdrant with weighted ranking (0.73ms avg)
- [x] **DuckDB analytics** - Parquet snapshots and analytical views
- [x] **Qdrant vector search** - Infrastructure ready, stub embedder implemented
- [x] **Markdown export** - Export tasks with prompt suggestions
- [x] **Slack connector** - Socket Mode integration
- [x] **Microsoft 365 connector** - Outlook + Calendar integration
- [ ] Real OpenAI embeddings (currently using stub)
- [ ] CLI/TUI for local usage
- [ ] Advanced filtering and date ranges
- [ ] Query caching and optimization

## 🛠️ Development

Built with:
- **TypeScript** - Type-safe development
- **Bun** - Fast JavaScript runtime and package manager
- **SQLite** - High-performance local database with FTS5
- **DuckDB** - Analytics and Parquet export
- **Qdrant** - Vector search for semantic similarity
- **MCP SDK** - Model Context Protocol
- **Vitest** - Fast unit testing

## ⚡ Performance

- **Hybrid search**: 0.73ms average (164x faster than 120ms target)
- **Task list**: Sub-100ms with FTS5 indexing
- **Keyword search**: ~0.2ms on 15 tasks
- **Ready for scale**: Tested with invoice mismatch scenarios

## 📄 License

MIT