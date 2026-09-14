# mux Architecture (Phase 1)

## Overview

`mux` is designed as a multiplayer terminal workspace for software engineering teams. In Phase 1, it provides the core communication layer, presence tracking, and real-time state synchronization over LAN/local network.

## System Topology

```text
┌─────────────────────────────────────────────────────────────┐
│                         mux Relay                           │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    HTTP & WS Server                 │   │
│   │                 (Node.js / ws Engine)               │   │
│   └──────────┬───────────────────────────────┬──────────┘   │
│              │                               │              │
│              ▼                               ▼              │
│   ┌─────────────────────┐         ┌─────────────────────┐   │
│   │  ConnectionManager  │         │   EventDispatcher   │   │
│   │  - Socket registry  │         │   - Zod validation  │   │
│   │  - Ping/Pong timer  │         │   - Broadcast logic │   │
│   └─────────────────────┘         └──────────┬──────────┘   │
│                                              │              │
│                                              ▼              │
│                                   ┌─────────────────────┐   │
│                                   │   SQLite Database   │   │
│                                   │   (better-sqlite3)  │   │
│                                   └─────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
             WebSocket / HTTP (LAN)
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌────────────────────────┐  ┌────────────────────────┐
│   mux Client (Host)    │  │   mux Client (Teammate)│
│                        │  │                        │
│   - RelayClient (WS)   │  │   - RelayClient (WS)   │
│   - Ink Terminal UI    │  │   - Ink Terminal UI    │
│   - Local State Cache  │  │   - Local State Cache  │
└────────────────────────┘  └────────────────────────┘
```

## Core Packages & Responsibilities

1. **`@mux/protocol`**:
   - Provides canonical TypeScript types and Zod schemas.
   - Enforces valid payload shapes for all client messages (`client.join`, `client.send_message`, `client.leave`) and server messages (`server.welcome`, `server.event`, `server.error`, `server.pong`).

2. **`@mux/database`**:
   - Encapsulates SQLite tables: `workspaces`, `users`, `sessions`, `events`, `messages`.
   - Uses `better-sqlite3` with WAL mode on disk and supports fast in-memory execution for tests.

3. **`@mux/relay`**:
   - Exposes HTTP endpoints (`/health`, `/api/workspaces`) and WebSocket server.
   - Dispatches validated events to all active peers within the same workspace.

4. **`@mux/cli`**:
   - Built with React for CLI (`ink`).
   - Renders a multi-pane TUI layout: Header, Teammates/Presence sidebar, Real-time Activity/Message Stream, and Interactive Input Bar.
