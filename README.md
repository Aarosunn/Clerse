# Clerse

An infinite spatial canvas where Claude conversations are nodes. Branch any conversation without polluting context. Stream multiple nodes simultaneously. Share a canvas with a second cursor in real time.

---

## Three Main Features

1. **Branch spatially** — right-click any message and fork a new conversation node onto the canvas. The original is untouched.
2. **Parallel streams** — send messages to two nodes at once and watch both stream simultaneously, independently.
3. **Multiplayer** — click Share. A second cursor appears on the canvas in real time.

---

## What You Can Do

### Node Types

**Input nodes** — drag in context, connect to any output node:
- **PDF** — drop a file, pymupdf extracts text per page
- **YouTube** — paste a URL, transcript is fetched automatically
- **Article** — paste a URL, trafilatura extracts the article body
- **Image** — drop an image, passed directly to Claude's vision API
- **Text** — freeform context block

**Output nodes** — Claude generates these mid-conversation via tools:
- **Claude node** — branching conversation with Markdown + KaTeX rendering
- **Flashcard node** — streamed JSON rendered as flippable cards
- **Quiz node** — multiple choice with scoring and explanations
- **PDF Doc node** — Claude-generated document, downloadable as PDF
- **Artifact node** — persistent Markdown artifact pinned to the canvas

### Canvas

- Infinite pan/zoom via React Flow
- Nodes connect with animated river edges
- Drag any node anywhere — layout is yours
- Connect any input node to any output node for context injection

### Branching

Claude can call a `create_branches` tool mid-conversation to spawn 2–4 parallel branches, each inheriting selective message context. Users can also branch manually from any message. Each branch is a fully independent conversation node.

### Multiplayer

One click creates a Liveblocks room. Share the link. Canvas state, node positions, and cursor presence sync in real time across all participants.

### Persistence

All workspaces auto-save to Neon (serverless Postgres) every 30 seconds and on disconnect. Canvas layout stored as a JSONB blob. Messages, files, and branches in normalized tables.

---

## Tech Stack

```
Frontend     Next.js 15 + React Flow (TypeScript)
Backend      FastAPI (Python) on Railway
Database     Neon (serverless Postgres) — SQLAlchemy 2.0 async + Alembic
Multiplayer  Liveblocks
AI           Anthropic API — claude-sonnet-4-6 default
Deploy       Vercel (frontend) + Railway (backend)
```

---

## How We Built It — Claude as Co-Developer

This project was built in a 24-hour hackathon sprint using **Claude Code** with the **Superpowers** skill framework. Every major feature followed a structured AI-assisted workflow. Here is exactly how it worked.

### The Workflow

```
Brainstorm → Write Plan → Execute Plan (parallel subagents) → Verify → Review
```

Each skill is a prompt template invoked via the `Skill` tool in Claude Code. Skills override default behavior and enforce discipline at each phase.

---

### 1. Brainstorming (`superpowers:brainstorming`)

Before any code was written, every feature went through a structured brainstorming session:

- Claude explored existing project context (files, git history, docs)
- Asked clarifying questions **one at a time** — purpose, constraints, success criteria
- Proposed **2–3 approaches** with trade-offs before committing to one
- Presented a design section by section, with approval gates between each
- Wrote a **spec document** to `backend/docs/YYYY-MM-DD-<feature>-design.md` and committed it

Hard gate: no implementation could begin until the spec was written and approved.

### 2. Implementation Planning (`superpowers:writing-plans`)

After spec approval, Claude produced a detailed step-by-step implementation plan:

- Broken into discrete, independently executable tasks
- Each task scoped to a single file or function boundary
- Dependencies called out explicitly
- Saved as a plan document before any code was touched

### 3. Parallel Subagent Execution (`superpowers:subagent-driven-development` + `superpowers:dispatching-parallel-agents`)

Independent tasks from the plan were dispatched to **parallel subagents** running simultaneously:

- Each subagent worked in an **isolated git worktree** (`superpowers:using-git-worktrees`) — no shared state, no conflicts
- Subagents had no knowledge of each other's work
- The main agent coordinated, collected results, and integrated

Example: the context assembly engine, tool execution service, and extract endpoints were all built in parallel across separate worktrees and merged back in a single session.

### 4. Verification Before Completion (`superpowers:verification-before-completion`)

No task was marked complete without evidence. Before claiming any fix or feature was working:

- Verification commands were run and output confirmed
- Tests had to pass — not just "should pass"
- The skill blocked success claims without proof

### 5. Code Review (`superpowers:requesting-code-review`)

After each major feature landed, a code-reviewer subagent audited the implementation against:

- The original spec
- Coding standards from `CLAUDE.md` and `backend/CLAUDE.md`
- Architectural contracts (SSE format, service layer boundaries, no auth, no sync DB calls)

### 6. Systematic Debugging (`superpowers:systematic-debugging`)

When bugs appeared, a dedicated debugging skill enforced root-cause analysis before any fix:

- Reproduce → isolate → hypothesize → verify → fix
- No shotgun fixes, no retry loops

---

## Codebase Conventions (enforced via `CLAUDE.md`)

- All files `.tsx` / `.ts` — never `.jsx` / `.js`
- All Anthropic calls through Python backend `/chat` — never from client components
- Always stream with SSE + `EventSource` — never `response.json()` for chat
- Service layer pattern: `routers/` call `services/` — business logic never in route handlers
- React Flow handles all positioning — no custom drag logic
- Liveblocks handles multiplayer — no custom WebSocket logic
- No authentication — hardcoded API key is correct for hackathon scope

---

## Repository Structure

```
clerse/
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Canvas.tsx
│   │   │   ├── nodes/          # ClaudeNode, PDFNode, QuizNode, FlashcardNode, ...
│   │   │   └── edges/          # RiverEdge
│   │   └── api/
│   │       └── canvas/         # Workspace CRUD proxy
│   └── types/                  # nodes.ts, messages.ts
│
├── backend/
│   ├── app/
│   │   ├── routers/            # workspaces, chat, extract, files
│   │   ├── services/           # claude, context, tools, tool_execution, extract, skills
│   │   ├── models/             # SQLAlchemy ORM
│   │   └── schemas/            # Pydantic request/response
│   ├── alembic/                # migrations
│   ├── tests/                  # full test suite
│   └── docs/                   # per-feature spec documents written during brainstorming
│
└── CLAUDE.md                   # project instructions read by Claude on every session
```

---

## Spec Documents

Every feature has a design spec committed to `backend/docs/`:

| Feature | Spec |
|---------|------|
| Project foundation | `2026-03-28-project-foundation.md` |
| Skills, context, tools | `2026-03-28-skills-context-tools.md` |
| Workspace CRUD | `2026-03-28-workspace-crud.md` |
| Streaming chat + SSE | `2026-03-29-streaming-chat.md` |
| Tool result handling | `2026-03-29-tool-result-handling.md` |
| Content extraction | `2026-03-29-content-extraction.md` |
| File upload | `2026-03-29-file-upload.md` |
| Branching endpoint | `2026-03-29-branching-endpoint.md` |
| Messages endpoint | `2026-03-29-messages-get-endpoint.md` |
