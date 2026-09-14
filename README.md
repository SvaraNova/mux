<div align="center">

```text
 ███╗   ███╗██╗   ██╗██╗  ██╗
 ████╗ ████║██║   ██║╚██╗██╔╝
 ██╔████╔██║██║   ██║ ╚███╔╝ 
 ██║╚██╔╝██║██║   ██║ ██╔██╗ 
 ██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗
 ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝
```

### The Multiplayer Terminal for Humans & AI Coding Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node: >=20](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?logo=node.js)](https://nodejs.org/)
[![Tests: Passing](https://img.shields.io/badge/Tests-10%2F10_Passing-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![Platform](https://img.shields.io/badge/Platform-macOS_%7C_Linux_%7C_Windows-lightgrey.svg)](#installation)

<p align="center">
  <b>A real-time collaborative workspace where multiple software engineers and autonomous AI agents pair-program on the same codebase over local WiFi/LAN.</b>
</p>

---

[Key Concepts](#-key-concepts) •
[Visual Interface](#-visual-interface) •
[Architecture](#-architecture) •
[Installation (All OS)](#-installation-guide) •
[Quickstart](#-quickstart-guide) •
[Roadmap](#-mvp-roadmap)

---

</div>

## 💡 The Problem & The Vision

### Traditional Development
```text
Developer ──(prompt)──▶ AI Agent (Codex / agy / Claude) ──▶ Code in Isolation
```
Modern AI coding assistants are extraordinarily capable, but they operate as **isolated solo silos**. When multiple engineers collaborate on a sprint, each developer prompts their own agent separately. Context is lost, file edits collide, and handoffs happen through messy chat pastebins.

### The `mux` Paradigm
```text
Developer A ──▶ AI Agent A ──┐
                             ├──▶ [ mux Local Relay (LAN) ] ──▶ Git / GitHub
Developer B ──▶ AI Agent B ──┘           (WebSocket + SQLite)
```

`mux` turns any local repository into a **multiplayer terminal studio**:
- **Zero Cloud Lock-in**: Coordinates directly over your office or home WiFi/LAN.
- **Git is the Source of Truth**: Code lives in Git branches and commits; `mux` coordinates the collaboration layer.
- **Shared Team Awareness**: Realtime visibility of who is online, which AI agents are working, active tasks, and shared events.
- **Keyboard-First Experience**: Fully native terminal user interface (TUI) powered by React & Ink.

---

## 🖥 Visual Interface

```text
┌── PROJECT: MUX ────────────────────────── [CODE: MUX-84KM] ────── main ▾ ───┐
│                                                                             │
│  TEAM (3)               ACTIVITY & MESSAGES                                 │
│                                                                             │
│  ● yoga (you)           [15:41:02] ● yoga started the workspace             │
│  ● fajar                [15:41:18] ● fajar joined the workspace             │
│  ○ rizky (offline)      [15:41:30] <fajar>: Auth endpoints are deployed!    │
│                         [15:42:05] [DM] <yoga> → <fajar>: checking tests    │
│                         [15:42:19] [SYS] Task AUTH-01 claimed by fajar      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  > /msg @fajar Ready to review the login controller █                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗 Architecture

```mermaid
graph TD
    subgraph LAN ["Local Network / WiFi (LAN)"]
        subgraph RelayServer ["mux Relay Server (Port 7331)"]
            HTTP["HTTP API (/health, /api/workspaces)"]
            WSS["WebSocket Server (Event Hub)"]
            ConnMgr["Connection & Presence Manager"]
            Dispatcher["Zod Event & Message Dispatcher"]
            SQLite[("SQLite Persistence (.mux/relay.db)")]

            WSS --> ConnMgr
            WSS --> Dispatcher
            Dispatcher --> SQLite
        end

        subgraph ClientA ["Developer A (Terminal 1)"]
            HostClient["mux host / client"]
            TUI_A["Ink TUI Interface"]
            HostClient <--> TUI_A
        end

        subgraph ClientB ["Developer B (Terminal 2)"]
            JoinClient["mux join / client"]
            TUI_B["Ink TUI Interface"]
            JoinClient <--> TUI_B
        end

        ClientA <== "WebSocket (Realtime)" ==> WSS
        ClientB <== "WebSocket (Realtime)" ==> WSS
    end
```

---

## 📦 Monorepo Layout

`mux` is engineered as a clean, modular TypeScript monorepo managed with `pnpm`:

```text
mux/
├── apps/
│   ├── cli/             # Interactive Ink TUI and CLI commands (mux host, mux join, mux relay)
│   └── relay/           # Local collaboration server (HTTP + WebSocket + SQLite engine)
├── packages/
│   ├── protocol/        # Shared Zod validation schemas, event envelopes, and contracts
│   └── database/        # SQLite tables, WAL mode connection, and repository implementations
├── docs/                # Comprehensive architectural and protocol documentation
├── tests/               # Vitest automated test suite (unit + real multi-client integration)
├── pnpm-workspace.yaml  # Workspace definitions
├── tsconfig.base.json   # Strict TypeScript base configuration
└── package.json         # Workspace root scripts
```

---

## 🚀 Installation Guide

`mux` requires **Node.js 20+** and **pnpm** (or npm).

### 🍎 macOS

#### Method 1: Using Global Symlink (Recommended)
```bash
# 1. Clone the repository
git clone https://github.com/SvaraNova/mux.git
cd mux

# 2. Install dependencies & build
pnpm install
pnpm build

# 3. Symlink globally to your user bin
ln -sf "$(pwd)/apps/cli/dist/bin/mux.js" ~/.local/bin/mux

# 4. Verify installation
mux --help
```
*(Ensure `~/.local/bin` is in your `$PATH` inside `~/.zshrc`)*.

---

### 🐧 Linux (Ubuntu / Debian / Arch / Fedora)

```bash
# 1. Clone repository
git clone https://github.com/SvaraNova/mux.git
cd mux

# 2. Install dependencies & build
pnpm install
pnpm build

# 3. Create global symlink
mkdir -p ~/.local/bin
ln -sf "$(pwd)/apps/cli/dist/bin/mux.js" ~/.local/bin/mux

# 4. Add to PATH if needed
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 5. Verify installation
mux --help
```

---

### 🪟 Windows (PowerShell)

```powershell
# 1. Clone repository
git clone https://github.com/SvaraNova/mux.git
cd mux

# 2. Install dependencies & build
pnpm install
pnpm build

# 3. Run directly with node or tsx
pnpm mux --help

# Optional: Add to user profile alias
Set-Alias -Name mux -Value "$((Get-Location).Path)\apps\cli\dist\bin\mux.js"
```

---

## ⚡ Quickstart Guide

### 1. Host a Workspace (Terminal 1)
To start the collaboration server and open the interactive TUI:
```bash
mux host --project my-project --user Alice
```
* Generates a unique room Join Code (e.g. `MY-P-4B9A`).
* Starts the WebSocket relay server on `ws://0.0.0.0:7331`.
* Stores event logs in `my-project/.mux/relay.db`.

### 2. Teammate Joins (Terminal 2 / Another Machine on LAN)
In another terminal or another computer connected to the same WiFi:
```bash
mux join ws://localhost:7331 --project my-project --user Bob
```
*(On another machine, replace `localhost` with the host machine's LAN IP, e.g., `ws://192.168.1.50:7331`)*.

### 3. Standalone Relay Mode
If you prefer running the relay headless in the background (e.g. on a shared local server/Raspberry Pi):
```bash
mux relay --port 7331
```
Check health:
```bash
curl http://localhost:7331/health
# {"status":"ok","version":"0.1.0","timestamp":"..."}
```

---

## ⌨️ TUI Commands & Hotkeys

Inside the interactive terminal prompt:

| Command | Description | Example |
| :--- | :--- | :--- |
| `<text>` + `Enter` | Broadcasts a chat message to `#general` | `Hi everyone!` |
| `/msg @<user> <text>` | Sends a private direct message to a teammate | `/msg @Alice please check line 40` |
| `/clear` | Clears the local terminal event view | `/clear` |
| `/help` | Displays available in-terminal commands | `/help` |
| `/quit` or `Ctrl+C` | Gracefully disconnects and exits `mux` | `/quit` |

---

## 🧪 Verification & Testing

Every commit to `mux` is covered by strict typechecking and automated integration tests:

```bash
# Run strict TypeScript check across all packages
pnpm typecheck

# Run Vitest test suite (protocol schemas, SQLite, and multiplayer integration)
pnpm test
```

Test results:
```text
 ✓ tests/database.test.ts   (4 tests)
 ✓ tests/protocol.test.ts   (5 tests)
 ✓ tests/multiplayer.test.ts (1 test)

Test Files  3 passed (3)
Tests       10 passed (10)
```

---

## 🗺 MVP Roadmap

- [x] **Phase 1 — Skeleton & Core Relay**: Monorepo, shared Zod protocol, SQLite persistence, WebSocket hub, interactive Ink TUI, multi-client test.
- [ ] **Phase 2 — Realtime Collaboration**: Channels (`#general`, `#backend`), rich presence (`idle`, `working`, `offline`), `/events` audit stream.
- [ ] **Phase 3 — Task Coordination**: Task creation, claiming, progress states, and live broadcast.
- [ ] **Phase 4 — Git State Awareness**: Branch detection, commit notifications (`git.commit.created`), dirty state tracking.
- [ ] **Phase 5 — Generic Agent Core**: Provider-independent `AgentAdapter`, `AgentRegistry`, lifecycle hooks.
- [ ] **Phase 6 — Codex & CLI Agent Integration**: Programmatic agent runner, output streaming, prompt injection.
- [ ] **Phase 7 — Team MCP Tools**: Local Model Context Protocol server exposing `team.*` tool calls.
- [ ] **Phase 8 — Structured Handoff**: End-to-end task and branch handoff between agents.
- [ ] **Phase 9 — Soft File Reservations**: Warning signals when agents touch overlapping source files.
- [ ] **Phase 10 — mDNS LAN Discovery**: Zero-config network discovery (`mux discover`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
