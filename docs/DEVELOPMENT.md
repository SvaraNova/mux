# mux Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Git

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Compile TypeScript packages:
   ```bash
   pnpm build
   ```

3. Run Typecheck:
   ```bash
   pnpm typecheck
   ```

4. Run Tests:
   ```bash
   pnpm test
   ```

## Running the Development CLI

You can execute the CLI directly via `pnpm mux`:

```bash
# Start host relay and interactive TUI
pnpm mux host --project demo --user Alice

# In another terminal window, join the workspace
pnpm mux join ws://localhost:7331 --project demo --user Bob
```
