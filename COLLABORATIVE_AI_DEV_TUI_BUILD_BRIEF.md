# Collaborative AI Development TUI — MVP Build Brief

## 0. Mission

Build a **terminal-based collaborative development workspace** where multiple humans and multiple AI coding agents can work on the same software project.

The first version must work **inside the same local network / WiFi (LAN)**.

The system should allow:

- Multiple developers to join the same project workspace.
- Each developer to use their own AI coding CLI/agent.
- AI agents to communicate with other AI agents through a structured relay.
- Humans to send messages to other humans or agents.
- Agents to hand off tasks to other agents.
- Shared awareness of:
  - active users
  - active agents
  - tasks
  - branches
  - commits
  - file ownership/reservations
  - handoffs
- Git/GitHub remains the source of truth for source code.
- The relay handles collaboration and coordination, not source control.

The product should feel like:

> **A multiplayer terminal for humans and coding agents.**

Do NOT over-engineer the first version.

---

# 1. Core Product Idea

Traditional flow:

```text
Human → AI Coding Agent
```

Target flow:

```text
Human
  ↓
AI Agent
  ↓
Team Relay
  ↓
Other Human / Other AI Agent
  ↓
Git / GitHub
```

Example:

```text
Developer A
  └── Codex A
       ├── implements backend auth
       ├── commits changes
       └── sends structured handoff
                ↓
            Team Relay
                ↓
Developer B
  └── Codex B
       ├── receives context
       ├── continues frontend integration
       └── opens PR
```

The important concept is:

**Agents must not communicate through unstructured free-form chat only.**

Agent-to-agent communication should support structured messages such as:

- message
- task
- handoff
- status
- commit notification
- review request
- file reservation
- file release

---

# 2. MVP Scope

Version target:

```text
v0.1
```

Must include:

- Terminal User Interface (TUI)
- Local LAN collaboration
- Project workspace
- Multiple users
- Multiple agents
- Codex support first
- Generic agent adapter architecture
- Realtime relay
- Human-to-human messaging
- Human-to-agent messaging
- Agent-to-agent messaging
- Agent presence
- User presence
- Tasks
- Task claiming
- Structured handoff
- Git repository awareness
- Current branch awareness
- Commit awareness
- File reservations
- Event log
- SQLite persistence

Do NOT build yet:

- public cloud SaaS
- payment
- billing
- OAuth platform
- complex RBAC
- enterprise SSO
- Kubernetes
- Redis
- Kafka
- autonomous AI swarm
- voice chat
- video
- GUI/web dashboard
- mobile app
- full project-management suite

Keep the MVP simple.

---

# 3. High-Level Architecture

```text
┌──────────────────────────────────────────────┐
│                PROJECT REPOSITORY            │
│                                              │
│                  Git / GitHub                │
└──────────────────────┬───────────────────────┘
                       │
                       │
              Git / GitHub Integration
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                  LOCAL RELAY                 │
│                                              │
│  - WebSocket                                 │
│  - HTTP API                                  │
│  - Presence                                  │
│  - Messaging                                 │
│  - Tasks                                     │
│  - Agent State                               │
│  - Handoffs                                  │
│  - File Reservations                         │
│  - Event Bus                                 │
│  - SQLite                                    │
└───────────────┬──────────────────┬───────────┘
                │                  │
        WiFi / Local LAN    WiFi / Local LAN
                │                  │
                ▼                  ▼

┌──────────────────────┐  ┌──────────────────────┐
│ Developer A          │  │ Developer B          │
│                      │  │                      │
│ TUI Client           │  │ TUI Client           │
│ Human                │  │ Human                │
│ Codex A              │  │ Codex B              │
│ Agent Adapter        │  │ Agent Adapter        │
└──────────────────────┘  └──────────────────────┘
```

---

# 4. Recommended Tech Stack

Prefer TypeScript unless there is a strong technical reason not to.

Recommended:

```text
Runtime:
- Node.js 22+

Language:
- TypeScript

TUI:
- Ink (React for CLI)
OR
- another mature TypeScript TUI framework

Networking:
- HTTP
- WebSocket

Server:
- Fastify
OR
- lightweight Node server

Database:
- SQLite

ORM:
- Drizzle ORM
OR
- lightweight SQL layer

Validation:
- Zod

Git:
- native git CLI through child_process
OR
- simple-git

LAN Discovery:
- mDNS / Bonjour

Package Manager:
- pnpm

Monorepo:
- pnpm workspace

Testing:
- Vitest
```

Avoid unnecessary infrastructure.

---

# 5. Repository Structure

Use a monorepo.

Suggested:

```text
collab-ai-tui/
│
├── apps/
│   ├── cli/
│   │   └── Collaborative TUI client
│   │
│   └── relay/
│       └── Local collaboration server
│
├── packages/
│   ├── protocol/
│   │   ├── message schemas
│   │   ├── event schemas
│   │   └── shared types
│   │
│   ├── agent-core/
│   │   ├── agent interface
│   │   ├── lifecycle
│   │   └── capabilities
│   │
│   ├── agent-codex/
│   │   └── Codex adapter
│   │
│   ├── git/
│   │   ├── repository state
│   │   ├── branch
│   │   ├── commits
│   │   └── diff helpers
│   │
│   ├── discovery/
│   │   └── LAN discovery / mDNS
│   │
│   └── database/
│       ├── schema
│       └── repositories
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROTOCOL.md
│   ├── AGENT_ADAPTER.md
│   └── DEVELOPMENT.md
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

# 6. CLI / TUI UX

Primary commands:

```bash
collab init
collab host
collab discover
collab join <host>
collab status
```

Example:

```bash
collab host
```

Output:

```text
Collaborative workspace started

Project : nadi
Host    : yoga-macbook.local
IP      : 192.168.1.10
Port    : 7331

Waiting for teammates...
```

Discover:

```bash
collab discover
```

Example:

```text
AVAILABLE WORKSPACES

● nadi
  host: yoga-macbook
  users: 2
  agents: 3

● ecommerce
  host: dev-machine
  users: 1
  agents: 1
```

Join:

```bash
collab join nadi.local
```

---

# 7. Main TUI Layout

Initial design:

```text
┌ PROJECT: NADI ───────────────────── main ▾ ─────────────┐
│                                                        │
│ AGENTS                WORKSPACE              TEAM      │
│                                                        │
│ ● yoga                src/                   #general  │
│   └ codex-yoga        ├ api/                 #backend  │
│      working          ├ components/          #ai       │
│                       └ lib/                           │
│ ● fajar                                              │
│   └ codex-fajar       TASKS                   ONLINE   │
│      idle             ✓ AUTH-01               ● yoga   │
│                       ◉ API-03                ● fajar  │
│ ● gemini-rizky        ○ UI-02                          │
│   offline                                              │
├────────────────────────────────────────────────────────┤
│ AGENT TERMINAL                                         │
│                                                        │
│ > implement authentication middleware                  │
│                                                        │
│ Inspecting current API structure...                    │
│                                                        │
│ ✓ modified src/api/auth.ts                             │
│ ✓ tests passing                                        │
├────────────────────────────────────────────────────────┤
│ TEAM                                                   │
│ [15:41] codex-fajar → codex-yoga: dashboard ready      │
│ [15:43] codex-yoga → codex-fajar: handoff AUTH-01      │
├────────────────────────────────────────────────────────┤
│ :                                                      │
└────────────────────────────────────────────────────────┘
```

The layout may evolve, but keep it keyboard-first.

---

# 8. TUI Commands

Inside TUI:

```text
/help

/agents
/users
/tasks
/team
/inbox
/events

/msg @user message
/msg @agent message

/task create
/task list
/task claim TASK-ID
/task done TASK-ID

/handoff @agent TASK-ID

/reserve <file-or-pattern>
/release <file-or-pattern>

/git
/branch
/commits
/diff

/status
/quit
```

Examples:

```text
/msg @codex-fajar auth backend selesai

/task claim AUTH-01

/handoff @codex-fajar AUTH-01
```

---

# 9. Collaboration Protocol

Create a shared protocol package.

Every event should have a common envelope.

Example:

```ts
type RelayEvent = {
  id: string
  type: string
  projectId: string

  sender: {
    type: "human" | "agent" | "system"
    id: string
  }

  target?: {
    type: "human" | "agent" | "channel"
    id: string
  }

  timestamp: string
  payload: unknown
}
```

---

# 10. Message Types

Implement at minimum:

```text
user.joined
user.left
user.status

agent.registered
agent.online
agent.offline
agent.status

message.direct
message.channel

task.created
task.claimed
task.completed
task.cancelled

handoff.created
handoff.accepted
handoff.rejected

git.branch.changed
git.commit.created

file.reserved
file.released

system.event
```

---

# 11. Structured Agent Handoff

This is one of the most important features.

Example schema:

```json
{
  "type": "handoff.created",

  "from": "codex-yoga",
  "to": "codex-fajar",

  "project": "nadi",

  "task": {
    "id": "AUTH-12",
    "title": "Integrate dashboard authentication"
  },

  "git": {
    "branch": "feat/auth",
    "commit": "e42a19f"
  },

  "summary": "Authentication middleware is complete.",

  "nextAction": "Connect dashboard session to /api/session.",

  "files": [
    "src/auth/*",
    "src/api/session.ts"
  ]
}
```

The receiving agent should be able to consume this handoff as context.

---

# 12. Agent Architecture

Do NOT hard-code the whole application around Codex.

Create a generic agent interface.

Example:

```ts
interface AgentAdapter {
  id: string

  provider: string

  capabilities(): Promise<AgentCapability[]>

  start(): Promise<void>

  stop(): Promise<void>

  send(input: AgentInput): Promise<void>

  provideContext(context: AgentContext): Promise<void>

  status(): Promise<AgentStatus>
}
```

Then:

```text
AgentAdapter
│
├── CodexAdapter
├── ClaudeCodeAdapter
├── GeminiCLIAdapter
└── LocalLLMAdapter
```

For MVP only Codex must work.

Other adapters can be placeholders/interfaces.

---

# 13. Codex Integration

Integrate Codex using the cleanest supported programmatic interface available in the local environment.

Priorities:

1. Programmatic Codex integration / app server if available.
2. MCP-based integration if appropriate.
3. CLI process adapter only if necessary.

Avoid fragile terminal-screen scraping.

The Codex adapter should support:

```text
start session
send user instruction
inject team message
inject structured handoff
receive agent output
detect running / idle / error
stop session
```

The TUI should not need to know Codex-specific details.

---

# 14. Team MCP

Create a local MCP server or equivalent agent-facing tool layer called:

```text
team
```

Expose tools similar to:

```text
team.send_message
team.read_inbox

team.list_agents
team.get_agent

team.create_task
team.list_tasks
team.claim_task
team.complete_task

team.handoff
team.accept_handoff

team.reserve_files
team.release_files

team.get_project_state
team.get_git_state
```

Goal:

Allow the AI agent itself to collaborate with other agents.

Example conceptual call:

```text
team.handoff(
  agent="codex-fajar",
  task="AUTH-12",
  commit="e42a19f",
  next_action="Implement dashboard login"
)
```

Do not let agents directly mutate other agent sessions.

Everything must go through the relay/protocol.

---

# 15. Git Integration

Git remains the source of truth.

Required Git information:

```text
repository
current branch
latest commit
dirty/clean state
changed files
recent commits
```

Useful commands:

```text
/git

/branch

/commits

/diff
```

When a commit is created, publish:

```text
git.commit.created
```

Example:

```json
{
  "agent": "codex-yoga",
  "branch": "feat/auth",
  "commit": "e42a19f",
  "message": "feat: implement authentication middleware"
}
```

Do NOT implement a custom source-control system.

---

# 16. GitHub Integration

GitHub integration is optional for the first bootable MVP but the architecture must support it.

Future integration:

```text
GitHub MCP
```

Capabilities:

```text
repository state
issues
pull requests
reviews
actions
```

The Team Relay coordinates work.

GitHub stores software collaboration artifacts.

Never duplicate GitHub unnecessarily.

---

# 17. Agent Presence

Agents should expose state.

Example:

```json
{
  "id": "codex-yoga",
  "owner": "yoga",
  "status": "working",
  "task": "AUTH-12",
  "branch": "feat/auth",
  "reservedFiles": [
    "src/auth/*"
  ]
}
```

Possible statuses:

```text
offline
idle
working
waiting
error
```

---

# 18. File Reservations

This is NOT a hard lock.

It is a collaboration signal.

Example:

```text
src/auth/*       → codex-yoga
src/components/* → codex-fajar
```

If another agent tries to reserve the same file/pattern, warn:

```text
WARNING

src/auth/session.ts is currently reserved by codex-yoga.

Task: AUTH-12
Branch: feat/auth
```

User may still override.

Git remains authoritative.

---

# 19. Tasks

Minimal task model:

```ts
type Task = {
  id: string
  title: string
  description?: string

  status:
    | "todo"
    | "claimed"
    | "in_progress"
    | "done"
    | "cancelled"

  createdBy: string

  claimedBy?: string

  branch?: string

  createdAt: string
  updatedAt: string
}
```

Example:

```text
AUTH-01   ✓ done
API-03    ◉ codex-yoga
UI-02     ○ unassigned
```

---

# 20. Relay Server

Relay server responsibilities:

```text
workspace management
user registry
agent registry
presence
messages
tasks
handoffs
file reservations
event distribution
persistence
```

Relay does NOT:

```text
write application code
replace Git
replace GitHub
control another computer
run arbitrary remote shell commands
```

For security, arbitrary remote command execution must be explicitly out of scope.

---

# 21. Networking

Use:

```text
HTTP
+
WebSocket
```

Default:

```text
port 7331
```

Example:

```text
http://192.168.1.10:7331
ws://192.168.1.10:7331
```

Implement reconnect logic.

Client state should recover after temporary network loss.

---

# 22. LAN Discovery

Implement mDNS.

Service name example:

```text
_collab-ai._tcp.local
```

Metadata:

```json
{
  "workspace": "nadi",
  "host": "yoga-macbook",
  "port": 7331
}
```

Command:

```bash
collab discover
```

Do not require users to manually know IP addresses when discovery works.

Manual IP join should still be supported.

---

# 23. Persistence

Use SQLite.

Suggested tables:

```text
projects
users
agents
sessions
messages
channels
tasks
handoffs
file_reservations
events
```

Event history should be queryable.

Do not implement event sourcing unless truly necessary.

---

# 24. Security for MVP

LAN does not mean unlimited trust.

Implement at least:

```text
workspace join token
random workspace ID
user identity
agent identity
basic message validation
schema validation
```

On host:

```bash
collab host
```

Return:

```text
Workspace: nadi
Join Code: NADI-84KM
```

Joining:

```bash
collab join yoga-macbook.local --code NADI-84KM
```

Do not implement arbitrary remote shell execution.

Agents may operate only inside their own local development environment.

---

# 25. Event Log

TUI should expose:

```text
/events
```

Example:

```text
15:41 user fajar joined
15:42 codex-fajar online
15:43 task AUTH-01 claimed by codex-yoga
15:46 files src/auth/* reserved by codex-yoga
15:55 commit e42a19f created
15:56 handoff AUTH-01 → codex-fajar
```

This will be very useful for debugging collaborative agent behavior.

---

# 26. Suggested Development Phases

## Phase 1 — Skeleton

Build:

```text
monorepo
shared types
relay server
CLI entrypoint
basic TUI
SQLite
```

Success:

Two terminals can connect to the same relay.

---

## Phase 2 — Realtime Collaboration

Build:

```text
presence
direct messages
channels
event log
```

Success:

Two developers on the same WiFi can talk through the TUI.

---

## Phase 3 — Tasks

Build:

```text
task create
task list
task claim
task complete
```

Success:

Both clients see realtime task changes.

---

## Phase 4 — Git Awareness

Build:

```text
repo detection
branch
commit
dirty state
changed files
```

Success:

TUI shows each developer/agent Git state.

---

## Phase 5 — Agent Core

Build generic:

```text
AgentAdapter
AgentRegistry
AgentSession
```

Do NOT integrate every provider.

---

## Phase 6 — Codex

Implement:

```text
CodexAdapter
```

Success:

Codex can be launched/connected through the TUI.

Human can:

```text
> ask Codex something
```

and see its response.

---

## Phase 7 — Team Tools

Build:

```text
team.send_message
team.read_inbox
team.list_agents
team.get_project_state
```

Success:

Codex A can send a structured team message.

---

## Phase 8 — Handoff

Implement:

```text
team.handoff
team.accept_handoff
```

Success scenario:

```text
Codex A
↓
complete backend
↓
commit
↓
handoff to Codex B
↓
Codex B receives task + branch + commit + context
```

---

## Phase 9 — File Reservations

Implement soft reservations.

Success:

Agents can see when another agent is working in the same area.

---

## Phase 10 — LAN Discovery

Implement:

```text
collab discover
```

Final MVP success:

Three machines on one WiFi can discover and join a shared workspace.

---

# 27. MVP Acceptance Test

The MVP is considered successful when this scenario works:

### Machine A

```bash
cd project
collab host
```

Starts workspace:

```text
nadi
```

Machine A runs:

```text
Codex A
```

---

### Machine B

```bash
cd project
collab discover
```

Finds:

```text
nadi
```

Then:

```bash
collab join nadi
```

Machine B runs:

```text
Codex B
```

---

### Workflow

Developer A:

```text
/task create Implement authentication backend
```

Codex A:

```text
/task claim AUTH-01
```

Codex A modifies code.

Codex A commits:

```text
feat: authentication backend
```

Codex A sends:

```text
/handoff @codex-b AUTH-01
```

Codex B receives:

```text
FROM   codex-a
TASK   AUTH-01
BRANCH feat/auth
COMMIT e42a19f

Authentication backend complete.

NEXT:
Integrate frontend login.
```

Codex B accepts.

Codex B continues development.

Both developers see all relevant events.

If this works reliably, MVP v0.1 is complete.

---

# 28. Design Principles

Follow these principles throughout development:

### 1. Git is the source of truth

Do not invent another source-control system.

### 2. Relay coordinates, Git stores code

Relay:

```text
communication
coordination
presence
tasks
handoffs
```

Git:

```text
code
branch
commit
merge
history
```

### 3. Human remains in control

No uncontrolled autonomous agent loops.

### 4. Structured agent communication

Prefer:

```text
task
handoff
commit
next action
files
```

instead of enormous raw chat histories.

### 5. Provider independence

Codex is the first provider.

Codex must not become the architecture.

### 6. LAN-first

Solve local collaboration first.

Cloud relay comes later.

### 7. Simple infrastructure

For MVP:

```text
TUI
WebSocket
HTTP
SQLite
Git
mDNS
```

That is enough.

---

# 29. Coding Requirements

Use:

```text
TypeScript strict mode
ESLint
Prettier
Zod validation
clear interfaces
modular architecture
```

Every package must have tests where meaningful.

Do not use `any` unless absolutely unavoidable.

Do not hide TypeScript errors.

Do not suppress failing tests.

---

# 30. Documentation Requirements

Create:

```text
README.md
docs/ARCHITECTURE.md
docs/PROTOCOL.md
docs/AGENT_ADAPTER.md
docs/DEVELOPMENT.md
```

README must include:

```text
what the project is
why it exists
installation
host workspace
discover workspace
join workspace
start agent
basic commands
```

---

# 31. Start Commands

Target developer experience:

```bash
git clone <repo>

cd collab-ai-tui

pnpm install

pnpm dev
```

CLI development:

```bash
pnpm collab host
```

or after global linking:

```bash
collab host
```

---

# 32. First Implementation Instruction

Start by creating the repository skeleton and **Phase 1 only**.

Do NOT immediately implement the entire system.

Initial milestone:

```text
1. monorepo
2. shared protocol package
3. relay server
4. SQLite
5. basic CLI
6. minimal TUI
7. WebSocket connection
8. two local TUI clients connected to one relay
```

After Phase 1 works:

- run tests
- run TypeScript check
- document current architecture
- show resulting directory structure
- show how to test two clients locally

Then continue sequentially through the phases.

Do not skip foundational architecture to make a fake demo.

---

# 33. Important AI Coding Agent Instruction

While implementing:

1. Inspect the repository before making assumptions.
2. Keep changes incremental.
3. Run tests after meaningful changes.
4. Run typecheck.
5. Do not replace working architecture without reason.
6. Keep dependencies minimal.
7. Prefer boring and maintainable technology.
8. Never fake agent communication using hard-coded demo data.
9. Real networking must work.
10. Real persistence must work.
11. Real Git detection must work.
12. Build the smallest real implementation first.

If an integration such as Codex App Server is unavailable in the current environment, create a clean adapter boundary and implement the best available fallback without contaminating the rest of the architecture.

---

# 34. Product Direction After MVP

Do NOT implement these now, but preserve architectural room for:

```text
internet-hosted relay
Tailscale/VPN collaboration
encrypted sessions
GitHub-native workflow
PR review agents
agent permissions
agent capability discovery
multi-repository workspace
cloud agent workers
remote development environments
shared AI memory/context
team knowledge
workflow automation
CI/CD agent events
agent delegation trees
multi-agent orchestration
```

Possible long-term product concept:

> A collaborative operating layer for software teams where humans and AI coding agents work together as first-class team members.

But MVP remains:

> **A multiplayer terminal for humans and coding agents over LAN.**
