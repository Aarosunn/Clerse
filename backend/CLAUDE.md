# Clerse Backend — Technical Context

> FastAPI backend for Clerse, an infinite canvas where AI-powered nodes connect and share context. Backend handles all Claude API calls, content extraction, persistence, and tool execution.

---

## Tech Stack

```
Runtime       Python 3.12+
Framework     FastAPI (async)
ORM           SQLAlchemy 2.0 async (mapped_column style)
Migrations    Alembic (async-aware)
Database      Neon (serverless Postgres) via asyncpg
AI            Anthropic SDK (Python) — all Claude calls live here
Extraction    pymupdf, youtube-transcript-api, trafilatura
Deploy        Railway (Procfile: uvicorn)
```

---

## Project Structure

```
backend/
├── main.py                          # FastAPI app, lifespan, router mounting
├── alembic.ini
├── alembic/
│   ├── env.py                       # async Alembic env
│   └── versions/
├── app/
│   ├── core/
│   │   ├── config.py                # Pydantic BaseSettings
│   │   └── database.py              # async engine, sessionmaker, get_db
│   ├── middleware/                   # CORS config
│   ├── models/
│   │   └── clerse.py                # All SQLAlchemy ORM models
│   ├── routers/
│   │   ├── workspaces.py            # Workspace CRUD
│   │   ├── chat.py                  # Claude streaming + tool execution
│   │   └── extract.py              # PDF, YouTube, Article extraction
│   ├── schemas/
│   │   └── clerse.py                # Pydantic request/response models
│   └── services/
│       ├── claude.py                # Anthropic streaming client
│       ├── context.py               # Context assembly engine
│       ├── tools.py                 # Tool definitions (JSON schema)
│       ├── tool_execution.py        # Tool execution functions
│       ├── skills.py                # System prompt variants
│       └── extract.py               # PDF/YouTube/Article extraction logic
├── pyproject.toml
└── .env
```

**Service layer rule:** Routers handle HTTP request/response only. All business logic lives in `services/`. This separation enables future MCP integration — MCP tools and HTTP routes call the same services.

---

## Architecture

### Data Flow

```
Client                      Backend                           External
──────                      ───────                           ────────
POST /chat                  →  1. Save user message to Neon
                               2. Assemble context
                                  (own messages + linked nodes)
                               3. Stream from Claude           → Anthropic API
                               4. Execute tools (if any)       → DB writes
                               5. Save assistant message
                            ←  SSE token chunks / done event

POST /extract/pdf           →  pymupdf extracts text           → returns text
POST /extract/youtube       →  youtube-transcript-api           → returns transcript
POST /extract/article       →  trafilatura extracts text        → returns text

PUT /workspaces/{id}        →  Save canvas_state JSONB to Neon
GET /workspaces/{id}        →  Load canvas_state + metadata
```

### Ownership Model

| Data | Owner | Why |
|------|-------|-----|
| Canvas layout (nodes, edges, viewport) | **Liveblocks Storage** (live) → auto-saved to **Neon JSONB** | Real-time multiplayer sync |
| Messages, files, branches | **Neon DB** (separate tables) | Queried per-node, written during streaming |
| Presence, cursors | **Liveblocks** | Frontend-only, no backend involvement |

The backend never pushes to Liveblocks directly. When tools create nodes, the SSE response includes the new node/edge data → the requesting client writes them to Liveblocks Storage → Liveblocks syncs to other clients.

---

## Database Schema

Four tables. Managed via Alembic. Canvas layout stored as JSONB blob — no separate nodes/edges tables.

### Table: `workspaces`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` default |
| `title` | VARCHAR(255) NOT NULL | Display name |
| `canvas_state` | JSONB | Full React Flow state (nodes, edges, viewport) |
| `created_at` | TIMESTAMPTZ | `server_default=func.now()` |
| `updated_at` | TIMESTAMPTZ | `server_default=func.now(), onupdate=func.now()` |

**`canvas_state` shape:**
```json
{
  "nodes": [
    {
      "id": "node-abc",
      "type": "chat",
      "position": {"x": 100, "y": 200},
      "data": {"title": "My Chat", "skill": "Tutor"}
    }
  ],
  "edges": [
    {"id": "edge-1", "source": "node-abc", "target": "node-def"}
  ],
  "viewport": {"x": 0, "y": 0, "zoom": 1}
}
```

### Table: `messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → workspaces | ON DELETE CASCADE |
| `node_id` | VARCHAR(100) NOT NULL | React Flow node ID (string, not FK) |
| `role` | VARCHAR(20) NOT NULL | `user` \| `assistant` \| `tool` |
| `content` | TEXT | Nullable (tool calls have no text content) |
| `tool_calls_json` | JSONB | Nullable; array of tool call objects |
| `tool_call_id` | VARCHAR(255) | Nullable; Anthropic tool_call_id |
| `tool_name` | VARCHAR(255) | Nullable |
| `created_at` | TIMESTAMPTZ | |

### Table: `files`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → workspaces | ON DELETE CASCADE |
| `node_id` | VARCHAR(100) | React Flow node ID |
| `filename` | VARCHAR(255) | Original filename |
| `content_type` | VARCHAR(100) | `image/png`, `image/jpeg`, `application/pdf`, `text/markdown` |
| `file_data` | TEXT | Base64-encoded bytes |
| `content_text` | TEXT | Nullable; extracted text content (for context assembly) |
| `created_at` | TIMESTAMPTZ | |

**Max file size: 10MB.** No S3 — base64 in Postgres for hackathon.

### Table: `branches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → workspaces | ON DELETE CASCADE |
| `parent_node_id` | VARCHAR(100) NOT NULL | Source node's React Flow ID |
| `child_node_id` | VARCHAR(100) NOT NULL | Branch node's React Flow ID |
| `source_message_ids` | JSONB | Array of message UUID strings |
| `created_at` | TIMESTAMPTZ | |

---

## Feature: Workspace CRUD

### ORM Model

```python
class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    canvas_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### Endpoints

```
POST   /api/workspaces                    → 201  {id, title, created_at}
GET    /api/workspaces/{workspace_id}     → 200  {id, title, canvas_state, created_at}
PUT    /api/workspaces/{workspace_id}     → 200  {id, title, updated_at}
DELETE /api/workspaces/{workspace_id}     → 204
```

**PUT body** (auto-save from frontend):
```json
{
  "canvas_state": { "nodes": [...], "edges": [...], "viewport": {...} },
  "title": "Optional new title"
}
```

---

## Feature: Streaming Chat (SSE)

The most complex feature. All Claude API calls go through this endpoint.

### Flow

```
1. Client POSTs to /api/chat
2. Backend saves user message to Neon
3. Backend calls context.assemble() → (system_prompt, messages, truncated)
4. Backend opens stream to Anthropic
5. Backend yields SSE events as tokens arrive
6. If Claude calls a tool:
   a. Accumulate the full tool input (comes in chunks)
   b. After stream ends, execute the tool
   c. Write results to DB
   d. Open a follow-up stream with tool result appended
7. Save final assistant message to DB
8. Yield `done` event with message_id + usage stats
```

### Endpoint

```
POST /api/chat
Content-Type: application/json
→ text/event-stream
```

**Request body:**
```json
{
  "workspace_id": "uuid",
  "node_id": "node-abc",
  "content": "Explain gradient descent",
  "model": "claude-sonnet-4-6",
  "connected_node_ids": ["node-def", "node-ghi"]
}
```

**`connected_node_ids`** is how the backend knows which nodes to include in context assembly. The frontend provides these because it has the graph (Liveblocks/React Flow). The backend does not query canvas_state for edges.

### SSE Event Format

All events are newline-delimited JSON prefixed with `data: `.

```
data: {"type": "token", "text": "Gradient descent is..."}

data: {"type": "tool_start", "name": "create_branches"}

data: {"type": "tool_result", "name": "create_branches", "nodes": [...], "edges": [...]}

data: {"type": "done", "message_id": "uuid", "usage": {"input_tokens": 512, "output_tokens": 128}, "context_truncated": false}

data: {"type": "error", "message": "Anthropic timeout"}
```

### Implementation (`services/claude.py`)

```python
async def stream_chat(
    workspace_id: uuid.UUID,
    node_id: str,
    user_content: str,
    connected_node_ids: list[str],
    model: str,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    # 1. Save user message
    user_msg = Message(workspace_id=workspace_id, node_id=node_id, role="user", content=user_content)
    db.add(user_msg)
    await db.commit()

    # 2. Assemble context
    system_prompt, messages, context_truncated = await assemble_context(
        workspace_id, node_id, connected_node_ids, db
    )

    # 3. Stream from Anthropic
    accumulated_text = ""
    tool_calls = []

    async with anthropic_client.messages.stream(
        model=model,
        max_tokens=settings.ANTHROPIC_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
        tools=TOOL_DEFINITIONS,
    ) as stream:
        async for event in stream:
            if event.type == "content_block_start" and event.content_block.type == "tool_use":
                yield sse_event({"type": "tool_start", "name": event.content_block.name})
                tool_calls.append({"id": event.content_block.id, "name": event.content_block.name, "input": ""})
            elif event.type == "content_block_delta":
                if hasattr(event.delta, "text"):
                    accumulated_text += event.delta.text
                    yield sse_event({"type": "token", "text": event.delta.text})
                elif hasattr(event.delta, "partial_json"):
                    if tool_calls:
                        tool_calls[-1]["input"] += event.delta.partial_json
        final_msg = await stream.get_final_message()
        usage = final_msg.usage

    # 4. Execute tools OUTSIDE the stream loop
    for tc in tool_calls:
        tc["input"] = json.loads(tc["input"])
        result = await execute_tool(tc["name"], tc["input"], workspace_id, node_id, db)
        yield sse_event({"type": "tool_result", "name": tc["name"], **result})

    # 5. Follow-up stream if tools were used
    if tool_calls:
        # Append tool calls and results to messages, open new stream
        # Same pattern as above, accumulate text
        ...

    # 6. Save assistant message
    assistant_msg = Message(workspace_id=workspace_id, node_id=node_id, role="assistant", content=accumulated_text)
    db.add(assistant_msg)
    await db.commit()

    # 7. Done
    yield sse_event({
        "type": "done",
        "message_id": str(assistant_msg.id),
        "usage": {"input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens},
        "context_truncated": context_truncated,
    })


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
```

### FastAPI Endpoint (`routers/chat.py`)

```python
@router.post("/chat")
async def post_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        stream_chat(body.workspace_id, body.node_id, body.content, body.connected_node_ids, body.model, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### Critical Rules
- Never execute tools inside the `async for event in stream` loop
- Always yield SSE events as `data: {...}\n\n` (double newline)
- Return `StreamingResponse` with `media_type="text/event-stream"`

---

## Feature: Context Assembly

Assembles the system prompt and message list for a Claude call by gathering context from the target node and all connected nodes.

### Algorithm (`services/context.py`)

```python
async def assemble_context(
    workspace_id: uuid.UUID,
    node_id: str,
    connected_node_ids: list[str],
    db: AsyncSession,
) -> tuple[str, list[dict], bool]:
    """Returns (system_prompt, anthropic_messages, context_truncated)"""

    # 1. Get node's skill from canvas_state
    workspace = await db.get(Workspace, workspace_id)
    node_data = find_node_in_canvas(workspace.canvas_state, node_id)
    skill = node_data.get("data", {}).get("skill") if node_data else None
    skill_prompt = get_skill_prompt(skill)

    # 2. Gather context from connected nodes by type
    prepend_blocks = []      # image/document blocks for first user message
    artifact_refs = []       # text content for system prompt
    linked_messages = []     # chat history from linked chat nodes

    for linked_id in connected_node_ids:
        linked_data = find_node_in_canvas(workspace.canvas_state, linked_id)
        if not linked_data:
            continue
        node_type = linked_data.get("type", "")

        if node_type == "chat":
            msgs = await get_node_messages(workspace_id, linked_id, db)
            linked_messages.extend(msgs)

        elif node_type in ("image", "pdf"):
            file = await get_node_file(workspace_id, linked_id, db)
            if file:
                prepend_blocks.append(build_file_block(file))

        elif node_type in ("text", "article", "youtube"):
            file = await get_node_file(workspace_id, linked_id, db)
            if file and file.content_text:
                title = linked_data.get("data", {}).get("title", "Context")
                artifact_refs.append(f"## {title}\n{file.content_text}")

    # 3. Build system prompt
    system = skill_prompt
    if artifact_refs:
        system += "\n\n---\nReference material:\n" + "\n\n".join(artifact_refs)

    # 4. Get own messages
    own_messages = await get_node_messages(workspace_id, node_id, db)

    # 5. Truncation
    total = len(linked_messages) + len(own_messages)
    context_truncated = total > 150
    if context_truncated:
        linked_messages = linked_messages[-10:]

    # 6. Build Anthropic messages list
    messages = []
    for msg in sorted(linked_messages + own_messages, key=lambda m: m.created_at):
        messages.append({"role": msg.role, "content": msg.content})

    # 7. Prepend file blocks to first user message
    if prepend_blocks and messages:
        for i, m in enumerate(messages):
            if m["role"] == "user":
                messages[i] = {
                    "role": "user",
                    "content": prepend_blocks + [{"type": "text", "text": m["content"]}]
                }
                break

    return system, messages, context_truncated
```

### Rules
- **One-hop only** — only directly connected nodes contribute context
- File blocks (image/PDF) must be inside a `user` role message — never in `assistant` messages
- Connected node IDs come from the frontend request body, not from parsing canvas_state edges

---

## Feature: Tools

Claude can call tools to mutate the canvas. Tool results are returned via SSE so the requesting client can add them to Liveblocks Storage.

### Tool Definitions (`services/tools.py`)

```python
TOOL_DEFINITIONS = [
    {
        "name": "create_branches",
        "description": "Create 2-4 parallel conversation branches exploring different angles of the current topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branches": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "rationale": {"type": "string"},
                            "relevant_message_indices": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "description": "0-based indices of messages most relevant to this branch"
                            }
                        },
                        "required": ["title"]
                    },
                    "minItems": 2, "maxItems": 4
                }
            },
            "required": ["branches"]
        }
    },
    {
        "name": "suggest_branch",
        "description": "Suggest a branch topic without creating it. User must confirm in the UI.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "reason": {"type": "string"}
            },
            "required": ["title", "reason"]
        }
    },
    {
        "name": "create_markdown",
        "description": "Save content (summary, notes, code, explanation) as a persistent artifact node on the canvas. Use Markdown + KaTeX for formatting.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string", "description": "Markdown + KaTeX content"}
            },
            "required": ["title", "content"]
        }
    },
    {
        "name": "generate_flashcards",
        "description": "Generate flashcards from the conversation context as a flashcard node.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "front": {"type": "string"},
                            "back": {"type": "string"}
                        },
                        "required": ["front", "back"]
                    }
                }
            },
            "required": ["title", "cards"]
        }
    },
    {
        "name": "generate_quiz",
        "description": "Generate quiz questions from the conversation context as a quiz node.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                            "correct_answer": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": ["question", "options", "correct_answer", "explanation"]
                    }
                }
            },
            "required": ["title", "questions"]
        }
    },
    {
        "name": "create_pdf_doc",
        "description": "Generate a formatted document as a PDF doc node. Use LaTeX for the content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string", "description": "LaTeX document content"}
            },
            "required": ["title", "content"]
        }
    }
]
```

### Tool Execution (`services/tool_execution.py`)

Each tool execution:
1. Creates node/edge data (for frontend to add to Liveblocks)
2. Writes content to DB (messages, files, branches) where applicable
3. Returns a dict with `nodes` and `edges` arrays for the SSE `tool_result` event

```python
async def execute_tool(name, input, workspace_id, source_node_id, db) -> dict:
    if name == "create_branches":
        return await execute_create_branches(input, workspace_id, source_node_id, db)
    elif name == "suggest_branch":
        return {"title": input["title"], "reason": input["reason"]}  # no DB write
    elif name == "create_markdown":
        return await execute_create_markdown(input, workspace_id, source_node_id, db)
    elif name == "generate_flashcards":
        return await execute_generate_flashcards(input, workspace_id, source_node_id, db)
    elif name == "generate_quiz":
        return await execute_generate_quiz(input, workspace_id, source_node_id, db)
    elif name == "create_pdf_doc":
        return await execute_create_pdf_doc(input, workspace_id, source_node_id, db)
    else:
        raise ValueError(f"Unknown tool: {name}")
```

**`execute_create_branches`** — For each branch:
1. Generate a React Flow node ID (e.g., `f"node-{uuid4()}"`)
2. Create a `branches` DB record with `source_message_ids` mapped from `relevant_message_indices`
3. Return `{"nodes": [{id, type: "chat", position, data: {title}}], "edges": [{source, target}]}`
4. Frontend receives this via SSE → adds to Liveblocks Storage

**`execute_create_markdown`** — Create a `files` record with `content_text = input["content"]`, return node + edge for frontend.

**`execute_generate_flashcards`** — Create a `files` record with `content_text = json.dumps(input["cards"])`, return node of type `flashcard` + edge.

**`execute_generate_quiz`** — Same pattern, node type `quiz`, store questions as JSON.

**`execute_create_pdf_doc`** — Create a `files` record with `content_text = input["content"]` (LaTeX), return node of type `pdf_doc` + edge.

### Branching

Both Claude (via tool) and users can create branches with selective context.

**Claude branching:** `create_branches` tool includes `relevant_message_indices` (0-based). Backend maps these to message UUIDs by querying the node's messages ordered by `created_at`, then stores UUIDs in `branches.source_message_ids`.

**User branching:**
```
POST /api/workspaces/{workspace_id}/nodes/{node_id}/branch
```
```json
{
  "source_message_ids": ["uuid-1", "uuid-2"],
  "title": "Deep dive into CNNs",
  "child_node_id": "node-xyz"
}
```

The frontend provides `child_node_id` because it creates the node in Liveblocks. The backend only creates the `branches` record.

---

## Feature: Content Extraction

Three endpoints that extract text from external sources. They return raw text — the frontend creates the node in Liveblocks.

### Endpoints (`routers/extract.py` → `services/extract.py`)

**PDF:**
```
POST /api/extract/pdf
Content-Type: multipart/form-data (field: "file")
→ 200  {"pages": [{"page": 1, "text": "..."}, ...], "filename": "doc.pdf"}
```
Uses `pymupdf` to extract text per page. Also save the file to the `files` table with extracted text in `content_text`.

**YouTube:**
```
POST /api/extract/youtube
Content-Type: application/json
{"url": "https://youtube.com/watch?v=..."}
→ 200  {"transcript": "full transcript text", "title": "Video Title"}
```
Uses `youtube-transcript-api`.

**Article:**
```
POST /api/extract/article
Content-Type: application/json
{"url": "https://example.com/article"}
→ 200  {"text": "extracted article text", "title": "Article Title"}
```
Uses `trafilatura`.

**All three require `workspace_id` and `node_id`** in the request body so the backend can store the extracted content in the `files` table for context assembly.

---

## Feature: Skills System

System prompt variants that change Claude's behavior per node. Stored in `canvas_state` node data as the `skill` field.

### Skills (`services/skills.py`)

```python
SKILLS: dict[str, str] = {
    "Default": (
        "You are a helpful AI assistant embedded in an infinite canvas. "
        "You have access to context from connected nodes. "
        "Be concise and structured. Use Markdown + KaTeX for formatting."
    ),
    "Tutor": (
        "You are a patient, encouraging tutor. Break complex topics into clear steps. "
        "Check for understanding. Use examples and analogies. "
        "Do not give answers directly — guide the student to discover them."
    ),
    "Socratic": (
        "You are a Socratic guide. Respond primarily with questions that lead the user "
        "to examine assumptions and reason their way to understanding. "
        "Resist giving direct answers."
    ),
    "Research Assistant": (
        "You are a research assistant. Summarize, synthesize, and cite accurately. "
        "Flag uncertainty. Structure long outputs with headers."
    ),
    "Brainstorm": (
        "You are a creative brainstorming partner. Generate diverse, unconventional ideas. "
        "Build on user ideas. Use yes-and thinking."
    ),
}
```

---

## Feature: Messages CRUD

### Endpoints

```
GET /api/workspaces/{workspace_id}/nodes/{node_id}/messages → 200  message[]
```

Messages are created implicitly during chat streaming (user message saved at start, assistant message saved at end). No standalone POST for messages — always go through `/api/chat`.

**GET response shape** (ordered by `created_at` ascending):
```json
[
  {"id": "uuid", "role": "user", "content": "...", "created_at": "..."},
  {"id": "uuid", "role": "assistant", "content": "...", "created_at": "..."}
]
```

---

## Feature: File Upload

For image nodes — direct file upload (not extraction).

```
POST /api/workspaces/{workspace_id}/files
Content-Type: multipart/form-data (field: "file")
```

**Request also requires:** `node_id` (form field)

Validates content type (images only for direct upload), validates size (max 10MB), stores as base64 in `files.file_data`.

---

## Node Types Reference

### Input Nodes (user provides)

| Type | Context contribution |
|------|----------------------|
| `pdf` | Injects as `document` block in first user message |
| `youtube` | Injects `content_text` into system prompt as reference |
| `article` | Injects `content_text` into system prompt as reference |
| `image` | Injects as `image` block in first user message |
| `text` | Injects `content_text` into system prompt as reference |

### Output Nodes (Claude generates via tools)

| Type | Tool | Content format |
|------|------|----------------|
| `chat` | `create_branches` | Standard conversation |
| `artifact` | `create_markdown` | Markdown + KaTeX |
| `flashcard` | `generate_flashcards` | JSON `[{front, back}]` |
| `quiz` | `generate_quiz` | JSON `[{question, options[], correct_answer, explanation}]` |
| `pdf_doc` | `create_pdf_doc` | LaTeX |

---

## Configuration (`app/core/config.py`)

```python
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str  # postgresql+asyncpg://...

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    ANTHROPIC_MAX_TOKENS: int = 4096

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

---

## Environment Variables

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
CORS_ORIGINS=["http://localhost:3000"]
```

---

## API Contracts (Backend ↔ Frontend)

| Contract | Value |
|----------|-------|
| SSE event types | `token`, `tool_start`, `tool_result`, `done`, `error` — exact strings |
| `tool_result` shape | Must include `nodes: [...]` and `edges: [...]` arrays |
| `connected_node_ids` | Frontend sends these with every chat request |
| `node_id` format | String (React Flow ID), not UUID FK |
| No file data in GET responses | Never include `file_data` (base64) in listing responses |
| SSE terminator | `data: {...}\n\n` (double newline) |
| Canvas state saved by frontend | Backend receives JSONB blob, never constructs it |

---

## What Goes Wrong — Anti-Patterns

- **Never execute tools inside the SSE stream loop** — wait for stream to complete first
- **Never return `response.json()` for chat** — always stream with SSE
- **Never query canvas_state to find edges** — use `connected_node_ids` from the request
- **Never push to Liveblocks from the backend** — return data via SSE, client handles Liveblocks
- **Never create separate nodes/edges DB tables** — canvas layout lives in JSONB
- **Never add authentication** — no auth for hackathon
- **Never add rate limiting** — removed from scope
- **Never use `response.json()` for Anthropic calls** — always stream token by token
- **Service layer rule** — never put business logic in routers, always in services/

---

## Dependencies (`pyproject.toml`)

```toml
dependencies = [
    "fastapi>=0.135.0",
    "uvicorn[standard]>=0.42.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.31.0",
    "alembic>=1.15.0",
    "anthropic>=0.52.0",
    "pymupdf>=1.27.0",
    "youtube-transcript-api>=0.6.0",
    "trafilatura>=2.0.0",
    "python-dotenv>=1.2.0",
    "python-multipart>=0.0.22",
    "pydantic-settings>=2.0.0",
]
```

---

## Bonus Features (Post-MVP)

### Local File Storage
Browser File System API — frontend writes JSON files mirroring the DB structure. Backend not involved. Same data shapes as Neon tables but as `.json` files on disk.

### MCP Integration
Backend becomes an MCP server. The service layer (`services/`) was designed for this — MCP tools wrap the same functions that HTTP routes call. No refactoring needed.
