# Clerse — CLAUDE.md

Spatial infinite canvas for Claude. Branch conversations, parallel AI streams, multiplayer collaboration. 24-hour hackathon sprint on top of existing MVP.

---

## What We're Building

Infinite canvas where Claude conversations are spatial nodes. Users branch off any node without polluting context. Multiple nodes stream simultaneously. Two people share the same canvas in real time.

**Three demo moments:**
1. Branch a conversation spatially
2. Two nodes streaming simultaneously — the wow moment
3. Second cursor appears — multiplayer

---

## Tech Stack

```
Frontend     Next.js + React Flow (TypeScript/TSX)
Backend      FastAPI (Python) on Railway
Database     Neon (serverless Postgres) via SQLAlchemy 2.0 async ORM + Alembic migrations
Multiplayer  Liveblocks
AI           Anthropic API via Python backend (claude-sonnet-4-6 default)
PDF          react-pdf (viewer) + @react-pdf/renderer (export) + pymupdf (backend extraction)
Deploy       Vercel (frontend) + Railway (backend)
```

---

## Project Structure

```
clerse/
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── api/
│   │   │   └── liveblocks-auth/route.ts
│   │   └── components/
│   │       ├── Canvas.tsx
│   │       ├── nodes/
│   │       │   ├── ClaudeNode.tsx
│   │       │   ├── PDFNode.tsx
│   │       │   ├── YouTubeNode.tsx
│   │       │   ├── ArticleNode.tsx
│   │       │   ├── ImageNode.tsx
│   │       │   ├── TextNode.tsx
│   │       │   ├── FlashcardNode.tsx
│   │       │   ├── QuizNode.tsx
│   │       │   ├── PDFDocNode.tsx
│   │       │   └── BranchConnector.tsx
│   │       ├── Toolbar.tsx
│   │       ├── ModelSelector.tsx
│   │       └── Presence.tsx
│   ├── lib/
│   │   ├── liveblocks.ts
│   │   └── conversations.ts
│   └── types/
│       ├── nodes.ts
│       └── messages.ts
│
├── backend/
│   ├── main.py
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── core/                           # config, db engine/session
│       │   ├── config.py
│       │   └── database.py
│       ├── middleware/                      # CORS
│       ├── models/                          # SQLAlchemy ORM models
│       ├── routers/                         # HTTP route handlers
│       │   ├── canvas.py
│       │   ├── chat.py                      # Claude API proxy + SSE streaming
│       │   └── extract.py                   # pdf, youtube, article
│       ├── schemas/                         # Pydantic request/response models
│       └── services/                        # business logic (MCP-ready)
│           ├── canvas.py
│           ├── chat.py
│           └── extract.py
│
├── CLAUDE.md
└── progress.md
```

---

## AI Architecture

All Claude calls go through the Python backend `POST /chat` endpoint. API key never touches the client.

```python
# app/routers/chat.py — SSE streaming via FastAPI
@router.post("/chat")
async def chat(request: ChatRequest):
    async with client.messages.stream(
        model=request.model or "claude-sonnet-4-6",
        max_tokens=4096,
        messages=request.messages,
    ) as stream:
        return StreamingResponse(stream_events(stream), media_type="text/event-stream")
```

Each node fires its own independent fetch to the backend `/chat` endpoint — parallel streaming requires no coordination. This is the core demo feature.

**Models:** `claude-haiku-4-5` / `claude-sonnet-4-6` (default) / `claude-opus-4-6`

---

## Node Types

### Input Nodes (user uploads/provides)
```
PDF node         red      drag PDF → pymupdf extracts text per page
YouTube node     blue     paste URL → youtube-transcript-api
Web article node green    paste URL → trafilatura extracts text
Image node       purple   drag image → base64 → Anthropic vision API
Text node        gray     freeform text context, connects to other nodes
```

### Output Nodes (Clerse generates)
```
Claude node      white    conversation, branches infinitely, Markdown + KaTeX output
Flashcard node   yellow   system prompt → JSON [{front, back}] → flippable UI
Quiz node        orange   system prompt → JSON [{question, options[], correct_answer, explanation}]
PDF doc node     red      Claude generates Markdown + KaTeX, downloadable via @react-pdf/renderer
```

All output nodes can be connected to other nodes to provide additional context.
When generating output nodes, Claude should respond with structured data only — no conversational wrapping.

**Flashcard system prompt:**
```python
FLASHCARD_SYSTEM_PROMPT = """Generate flashcards from the provided context.
Respond ONLY with a valid JSON array. No preamble, no markdown.
Format: [{"front": "question", "back": "answer"}]"""
```

**Quiz system prompt:**
```python
QUIZ_SYSTEM_PROMPT = """Generate quiz questions from the provided context.
Respond ONLY with a valid JSON array. No preamble, no markdown.
Format: [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "..."}]"""
```

**Backend extraction routes:** `POST /extract/pdf` · `POST /extract/youtube` · `POST /extract/article`

**Python deps:** `pymupdf` `youtube-transcript-api` `trafilatura` `anthropic`

**Image nodes:** base64 encode client-side, no backend needed. Pass directly in Anthropic messages array.

---

## Multiplayer

Liveblocks room created when user clicks Share. Share link = always joinable.

```typescript
// Canvas.tsx
const { others } = useOthers()
const [nodes, setNodes] = useStorage('nodes')
```

Liveblocks auth endpoint: `POST /api/liveblocks-auth` (Next.js API route) → returns room access token. ~10 lines, see Liveblocks docs.

---

## Database (Neon + SQLAlchemy 2.0 Async ORM)

Managed via Alembic migrations. Models in `app/models/`.

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, canvas_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Persistence

All workspaces persist to Neon by default. Debounced auto-save every 30s + save on disconnect.
Local file storage (Browser File System API) as optional alternative — see Bonus 1.

**Downloads (all client-side, no backend):**
- Summaries/artifacts → `.md` file (raw Markdown)
- PDF document nodes → `.pdf` via `@react-pdf/renderer`
- Flashcards/Quiz → `.json` or `.md`

---

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Backend (.env)
DATABASE_URL=
ANTHROPIC_API_KEY=
```

---

## What's Cut — Do Not Build

```
❌ Local file storage (bonus only, see below)
❌ Tauri / Electron / any desktop wrapper
❌ CLIProxyAPI or any local proxy
❌ Canvas LMS Chrome extension
❌ Google Drive integration
❌ Cosmetics marketplace / Stripe
❌ OCR / RAG / NotebookLM features
❌ Blueprint automation / Clerse Lens
❌ Authentication of any kind
❌ API key settings UI (hardcoded in .env)
```

---

## Conventions

- All files `.tsx` / `.ts` — never `.jsx` / `.js`
- React Flow handles all canvas drag/drop — never write custom positioning logic
- Liveblocks hooks only in `Presence.tsx` and `Canvas.tsx`
- All Anthropic calls through Python backend `/chat` — never from client components or Next.js API routes
- Always stream with SSE + `EventSource` or `ReadableStream` — never `response.json()` for chat
- FastAPI handles all server logic — Claude API, extraction, and DB persistence
- Service layer pattern: `routers/` call `services/` (MCP-ready architecture)
- No `any` types — define interfaces in `/types`

---

## What Claude Gets Wrong On This Project

- Use `.tsx` / `.ts` — never suggest `.jsx` or `.js`
- Never `response.json()` for Claude responses — always stream token by token
- Do not route Claude calls through Next.js API routes — all AI calls go through the Python backend
- Do not add authentication — hardcoded API key is correct for hackathon
- Do not suggest Tauri, CLIProxyAPI, or any local proxy
- Do not block parallel streaming with loading states — nodes stream independently
- React Flow handles positioning — do not write custom drag logic
- Liveblocks handles multiplayer — do not write custom WebSocket logic

---

## Demo Canvas

```
[YouTube]   [PDF]   [Article]   [Image]
     └──────────┴──────────┴──────────┘
                     ↓
          [Claude: synthesize sources]
                     │
         ┌───────────┴───────────┐
         ↓                       ↓
  [Flashcard node]        [Claude: quiz me]
   streaming cards         streaming Qs
   simultaneously          simultaneously
```

---

## BONUS — After Hour 16 Only

Do not start until parallel streaming + branching + multiplayer work on live Vercel URL.

### BONUS 1: Local File Storage (~2 hours)

Browser File System API — real JSON files on the user's disk. Not localStorage.

Pitch line: "Your data never leaves your machine."

User picks a folder once via `window.showDirectoryPicker()`. App reads/writes `canvas-{id}.json` and `node-{id}.json` directly. Use `idb-keyval` to persist the directory handle across page refreshes. Chrome/Edge only — fine for demo.

### BONUS 2: MCP Integration (post-hackathon roadmap only)

Clerse becomes an MCP server Claude Code calls as a tool. ToS-compliant path — Clerse is a display layer, Claude Code does inference. Users need no API key in Clerse.

**Hackathon pitch:** "Claude Code uses Clerse as a tool. Ask Claude to research a topic and it organizes results spatially — branching, parallel streams, on an infinite canvas. Your subscription powers it. Claude thinks in 2D."