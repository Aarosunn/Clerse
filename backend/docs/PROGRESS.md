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
Database     Neon (serverless Postgres)
Multiplayer  Liveblocks
AI           Anthropic API directly (claude-sonnet-4-6 default)
PDF          react-pdf (viewer) + pymupdf (backend extraction)
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
│   │   │   ├── canvas/route.ts
│   │   │   ├── chat/route.ts              # Anthropic API proxy + streaming
│   │   │   ├── extract/
│   │   │   │   ├── pdf/route.ts
│   │   │   │   ├── youtube/route.ts
│   │   │   │   └── article/route.ts
│   │   │   └── liveblocks-auth/route.ts
│   │   └── components/
│   │       ├── Canvas.tsx
│   │       ├── nodes/
│   │       │   ├── ClaudeNode.tsx
│   │       │   ├── PDFNode.tsx
│   │       │   ├── YouTubeNode.tsx
│   │       │   ├── ArticleNode.tsx
│   │       │   ├── ImageNode.tsx
│   │       │   ├── FlashcardNode.tsx
│   │       │   └── BranchConnector.tsx
│   │       ├── Toolbar.tsx
│   │       ├── ModelSelector.tsx
│   │       └── Presence.tsx
│   ├── lib/
│   │   ├── liveblocks.ts
│   │   ├── anthropic.ts
│   │   └── conversations.ts
│   └── types/
│       ├── nodes.ts
│       └── messages.ts
│
├── backend/
│   ├── main.py
│   ├── routes/
│   │   ├── canvas.py
│   │   └── extract.py                     # pdf, youtube, article
│   └── db/
│       └── neon.py
│
├── CLAUDE.md
└── progress.md
```

---

## AI Architecture

All Claude calls go through `/api/chat` server-side. API key never touches the client.

```typescript
// app/api/chat/route.ts — always stream, never response.json()
const stream = await client.messages.stream({
  model: model ?? 'claude-sonnet-4-6',
  max_tokens: 4096,
  messages,
})
return new Response(stream.toReadableStream())
```

Each node fires its own independent fetch to `/api/chat` — parallel streaming requires no coordination. This is the core demo feature.

**Models:** `claude-haiku-4-5` / `claude-sonnet-4-6` (default) / `claude-opus-4-6`

---

## Node Types

```
Claude node      white    conversation, branches infinitely
PDF node         red      drag PDF → pymupdf extracts text per page
YouTube node     blue     paste URL → youtube-transcript-api
Web article node green    paste URL → trafilatura extracts text
Image node       purple   drag image → base64 → Anthropic vision API
Flashcard node   yellow   fixed system prompt → JSON cards → flippable UI
```

**Flashcard system prompt — use exactly this:**
```typescript
const FLASHCARD_SYSTEM_PROMPT = `Generate flashcards from the provided context.
Respond ONLY with a valid JSON array. No preamble, no markdown.
Format: [{"front": "question", "back": "answer"}]`
```

**Backend extraction routes:** `POST /api/extract/pdf` · `POST /api/extract/youtube` · `POST /api/extract/article`

**Python deps:** `pymupdf` `youtube-transcript-api` `trafilatura`

**Image nodes:** base64 encode client-side, no backend needed. Pass directly in Anthropic messages array.

---

## Multiplayer

Private workspaces use React state only — zero Liveblocks rooms consumed. Room created only when user clicks Share.

```typescript
// Canvas.tsx
const { others } = useOthers()
const [nodes, setNodes] = useStorage('nodes')
```

Liveblocks auth endpoint: `POST /api/liveblocks-auth` → returns room access token. ~10 lines, see Liveblocks docs.

---

## Database Schema (Neon)

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, canvas_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Environment Variables

```bash
# Frontend (.env.local)
ANTHROPIC_API_KEY=
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Backend (.env)
DATABASE_URL=
LIVEBLOCKS_SECRET_KEY=
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
- All Anthropic calls through `/api/chat` — never from client components
- Always stream with `ReadableStream` + `TextDecoder` — never `response.json()` for chat
- FastAPI handles extraction only — all other logic in Next.js API routes
- No `any` types — define interfaces in `/types`

---

## What Claude Gets Wrong On This Project

- Use `.tsx` / `.ts` — never suggest `.jsx` or `.js`
- Never `response.json()` for Claude responses — always stream token by token
- Do not store conversation history in DB for private workspaces — React state is intentional
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