# mux — Collaborative AI Development TUI

> **A multiplayer terminal for humans and AI coding agents.**

`mux` is a terminal-based collaborative workspace that enables multiple developers and AI agents to collaborate in real-time over local network (LAN) and WebSockets.

---

## Architecture (Phase 1 MVP)

```text
┌─────────────────────────────────────────────────────────┐
│                       mux RELAY                         │
│                                                         │
│  - WebSocket Server (Port 7331)                         │
│  - SQLite Persistence (.mux/relay.db or in-memory)      │
│  - Realtime Event & Message Dispatcher                  │
│  - Presence & Session Tracker                           │
│  - REST API (/health, /api/workspaces)                  │
└──────────────┬───────────────────────────┬──────────────┘
               │                           │
         WebSocket (LAN)             WebSocket (LAN)
               │                           │
               ▼                           ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Terminal A (Host / Client)  │ │ Terminal B (Client)         │
│ User: Alice                 │ │ User: Bob                   │
│ CLI / Ink TUI               │ │ CLI / Ink TUI               │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## Monorepo Structure

```text
mux/
├── apps/
│   ├── cli/             # Interactive Ink TUI & CLI entrypoint (mux host, mux join, mux relay)
│   └── relay/           # Local collaboration server (HTTP + WebSocket + SQLite)
├── packages/
│   ├── protocol/        # Shared Zod schemas, event envelopes & TypeScript types
│   └── database/        # SQLite schema & repositories (workspaces, users, events, messages)
├── tests/               # Vitest test suite (protocol, database, and multiplayer integration)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Quick Start

### 1. Installation

```bash
pnpm install
```

### 2. Run Tests & Typecheck

```bash
# Run all unit and integration tests
pnpm test

# Run strict TypeScript typecheck
pnpm typecheck
```

---

## Testing Multiplayer Locally (Two Terminals)

### Terminal 1: Host the workspace

```bash
pnpm mux host --project demo --user Alice
```

This starts the local relay server on `ws://localhost:7331` and launches the interactive TUI as user **Alice**.

### Terminal 2: Join the workspace

```bash
pnpm mux join ws://localhost:7331 --project demo --user Bob
```

This launches the interactive TUI as user **Bob** and connects to the existing relay.

### Verification in TUI:
1. **Presence**: Terminal 1 will show `Bob` appear in the `TEAM` sidebar with a green indicator `●`.
2. **Activity**: Terminal 1 and 2 will display `[TIME] ● Bob joined the workspace`.
3. **Chat**: Type a message in Terminal 1 (e.g. `Hello Bob!`) and press `Enter`. The message will appear live on both terminals!
4. **Direct Messages**: Type `/msg @Bob Hey Bob, check this out` to send a private direct message.
5. **Commands**: Type `/help` for command options or `/quit` to disconnect.
