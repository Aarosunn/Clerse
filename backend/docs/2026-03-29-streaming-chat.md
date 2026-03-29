# Streaming Chat Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full `/api/chat` SSE streaming endpoint — save user message, assemble context, stream from Anthropic, execute tools out-of-loop, handle follow-up stream, save assistant message, yield done event.

**Architecture:** `routers/chat.py` handles HTTP only; `services/claude.py` owns the async SSE generator; `services/tool_execution.py` owns all tool executors. The Anthropic stream loop accumulates tool calls, then executes them only after the stream closes. If tools fire, a second stream follows with tool results appended to the message list.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Anthropic Python SDK (streaming), pytest-asyncio, aiosqlite (test DB)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/schemas/clerse.py` | Add `ChatRequest`, `MessageResponse` |
| Create | `app/services/tool_execution.py` | All 6 tool executors + `execute_tool()` dispatcher |
| Create | `app/services/claude.py` | `stream_chat()` async SSE generator |
| Create | `app/routers/chat.py` | `POST /api/chat` → `StreamingResponse` |
| Modify | `main.py` | Mount chat router |
| Create | `tests/conftest.py` | Async SQLite DB fixture + workspace fixture |
| Create | `tests/test_tool_execution.py` | All executor unit tests |
| Create | `tests/test_claude.py` | `stream_chat()` tests with mocked Anthropic |
| Create | `tests/test_chat_router.py` | HTTP endpoint integration test |

---

## Task 1: ChatRequest Schema

**Files:**
- Modify: `app/schemas/clerse.py`

- [ ] **Step 1: Add schemas**

Append to `app/schemas/clerse.py`:

```python
class ChatRequest(BaseModel):
    workspace_id: uuid.UUID
    node_id: str
    content: str
    model: str = "claude-sonnet-4-6"
    connected_node_ids: list[str] = []


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Verify import works**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -c "from app.schemas.clerse import ChatRequest, MessageResponse; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add app/schemas/clerse.py
git commit -m "feat: add ChatRequest and MessageResponse schemas"
```

---

## Task 2: Tool Execution Service

**Files:**
- Create: `app/services/tool_execution.py`
- Create: `tests/conftest.py`
- Create: `tests/test_tool_execution.py`

- [ ] **Step 1: Write failing tests**

Create `tests/conftest.py`:

```python
import asyncio
import uuid
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.clerse import Base, Workspace


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def workspace(db):
    ws = Workspace(title="Test Workspace")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws
```

Create `tests/test_tool_execution.py`:

```python
import json
import uuid
import pytest

from app.models.clerse import Branch, File, Message
from app.services.tool_execution import execute_tool
from sqlalchemy import select


@pytest.mark.asyncio
async def test_execute_suggest_branch(workspace, db):
    result = await execute_tool(
        "suggest_branch",
        {"title": "CNNs", "reason": "dive deeper"},
        workspace.id,
        "node-1",
        db,
    )
    assert result["title"] == "CNNs"
    assert result["reason"] == "dive deeper"
    # No DB writes
    branches = list((await db.execute(select(Branch))).scalars().all())
    assert len(branches) == 0


@pytest.mark.asyncio
async def test_execute_create_branches_saves_branch_records(workspace, db):
    # Seed 3 messages for the source node
    for i, role in enumerate(["user", "assistant", "user"]):
        msg = Message(
            workspace_id=workspace.id,
            node_id="node-1",
            role=role,
            content=f"msg {i}",
        )
        db.add(msg)
    await db.commit()

    result = await execute_tool(
        "create_branches",
        {
            "branches": [
                {"title": "Branch A", "relevant_message_indices": [0, 1]},
                {"title": "Branch B", "relevant_message_indices": [2]},
            ]
        },
        workspace.id,
        "node-1",
        db,
    )

    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 2
    assert result["nodes"][0]["type"] == "chat"
    assert result["nodes"][0]["data"]["title"] == "Branch A"

    branches = list((await db.execute(select(Branch))).scalars().all())
    assert len(branches) == 2
    assert branches[0].parent_node_id == "node-1"
    assert len(branches[0].source_message_ids) == 2


@pytest.mark.asyncio
async def test_execute_create_markdown(workspace, db):
    result = await execute_tool(
        "create_markdown",
        {"title": "My Notes", "content": "# Hello\n\nWorld"},
        workspace.id,
        "node-1",
        db,
    )

    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["type"] == "artifact"
    assert len(result["edges"]) == 1

    files = list((await db.execute(select(File))).scalars().all())
    assert len(files) == 1
    assert files[0].content_text == "# Hello\n\nWorld"
    assert files[0].content_type == "text/markdown"


@pytest.mark.asyncio
async def test_execute_generate_flashcards(workspace, db):
    cards = [{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]
    result = await execute_tool(
        "generate_flashcards",
        {"title": "My Flashcards", "cards": cards},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "flashcard"
    files = list((await db.execute(select(File))).scalars().all())
    assert json.loads(files[0].content_text) == cards


@pytest.mark.asyncio
async def test_execute_generate_quiz(workspace, db):
    questions = [
        {
            "question": "What is 2+2?",
            "options": ["1", "2", "3", "4"],
            "correct_answer": "4",
            "explanation": "Basic arithmetic",
        }
    ]
    result = await execute_tool(
        "generate_quiz",
        {"title": "My Quiz", "questions": questions},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "quiz"
    files = list((await db.execute(select(File))).scalars().all())
    assert json.loads(files[0].content_text) == questions


@pytest.mark.asyncio
async def test_execute_create_pdf_doc(workspace, db):
    result = await execute_tool(
        "create_pdf_doc",
        {"title": "My Doc", "content": r"\section{Intro} Hello"},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "pdf_doc"
    files = list((await db.execute(select(File))).scalars().all())
    assert r"\section{Intro} Hello" in files[0].content_text


@pytest.mark.asyncio
async def test_execute_tool_unknown_raises(workspace, db):
    with pytest.raises(ValueError, match="Unknown tool"):
        await execute_tool("nonexistent", {}, workspace.id, "node-1", db)
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_tool_execution.py -v 2>&1 | head -40
```

Expected: ImportError or ModuleNotFoundError (file doesn't exist yet)

- [ ] **Step 3: Create `app/services/tool_execution.py`**

```python
# app/services/tool_execution.py
from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import Branch, File, Message


async def execute_tool(
    name: str,
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Dispatch to the appropriate tool executor. Returns dict with nodes + edges."""
    if name == "create_branches":
        return await _execute_create_branches(input, workspace_id, source_node_id, db)
    if name == "suggest_branch":
        return {"title": input["title"], "reason": input["reason"]}
    if name == "create_markdown":
        return await _execute_create_markdown(input, workspace_id, source_node_id, db)
    if name == "generate_flashcards":
        return await _execute_generate_flashcards(input, workspace_id, source_node_id, db)
    if name == "generate_quiz":
        return await _execute_generate_quiz(input, workspace_id, source_node_id, db)
    if name == "create_pdf_doc":
        return await _execute_create_pdf_doc(input, workspace_id, source_node_id, db)
    raise ValueError(f"Unknown tool: {name}")


async def _execute_create_branches(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    branches_input = input["branches"]
    num = len(branches_input)

    # Fetch source node messages ordered by created_at to map indices → UUIDs
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == source_node_id)
        .order_by(Message.created_at)
    )
    node_messages = list(result.scalars().all())
    message_id_map: list[str] = [str(m.id) for m in node_messages]

    nodes = []
    edges = []

    for i, branch in enumerate(branches_input):
        child_node_id = f"node-{uuid.uuid4()}"
        # Spread branch nodes vertically around the source
        y_offset = (i - (num - 1) / 2) * 220
        nodes.append({
            "id": child_node_id,
            "type": "chat",
            "position": {"x": 400, "y": y_offset},
            "data": {"title": branch["title"]},
        })
        edges.append({
            "id": f"edge-{uuid.uuid4()}",
            "source": source_node_id,
            "target": child_node_id,
        })

        # Map relevant_message_indices → message UUIDs
        relevant_indices = branch.get("relevant_message_indices", [])
        source_msg_ids = [
            message_id_map[idx]
            for idx in relevant_indices
            if 0 <= idx < len(message_id_map)
        ]

        db.add(Branch(
            workspace_id=workspace_id,
            parent_node_id=source_node_id,
            child_node_id=child_node_id,
            source_message_ids=source_msg_ids,
        ))

    await db.commit()
    return {"nodes": nodes, "edges": edges}


async def _execute_create_markdown(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.md",
        content_type="text/markdown",
        content_text=input["content"],
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "artifact", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_generate_flashcards(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.json",
        content_type="application/json",
        content_text=json.dumps(input["cards"]),
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "flashcard", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_generate_quiz(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.json",
        content_type="application/json",
        content_text=json.dumps(input["questions"]),
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "quiz", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_create_pdf_doc(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.tex",
        content_type="application/x-latex",
        content_text=input["content"],
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "pdf_doc", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


def _make_node(node_id: str, node_type: str, title: str) -> dict:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 400, "y": 0},
        "data": {"title": title},
    }


def _make_edge(source: str, target: str) -> dict:
    return {
        "id": f"edge-{uuid.uuid4()}",
        "source": source,
        "target": target,
    }
```

- [ ] **Step 4: Install test deps and run tests**

```bash
cd /home/asunaron/hackathons/Clerse/backend
pip install pytest pytest-asyncio aiosqlite -q
python -m pytest tests/test_tool_execution.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/tool_execution.py tests/conftest.py tests/test_tool_execution.py
git commit -m "feat: implement tool execution service — all 6 canvas tools"
```

---

## Task 3: Claude Streaming Service

**Files:**
- Create: `app/services/claude.py`
- Create: `tests/test_claude.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_claude.py`:

```python
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.clerse import Message, Workspace
from app.services.claude import stream_chat, sse_event
from sqlalchemy import select


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_text_event(text: str):
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.text = text
    del event.delta.partial_json  # ensure attribute absent
    return event


def _make_tool_start_event(tool_id: str, tool_name: str):
    event = MagicMock()
    event.type = "content_block_start"
    event.content_block = MagicMock()
    event.content_block.type = "tool_use"
    event.content_block.id = tool_id
    event.content_block.name = tool_name
    return event


def _make_partial_json_event(partial: str):
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.partial_json = partial
    del event.delta.text  # ensure attribute absent
    return event


def _make_final_message(input_tokens=100, output_tokens=50):
    msg = MagicMock()
    msg.usage = MagicMock()
    msg.usage.input_tokens = input_tokens
    msg.usage.output_tokens = output_tokens
    return msg


def _mock_stream(events: list, final_message):
    """Build a mock async context manager that yields events."""
    stream = MagicMock()
    stream.__aenter__ = AsyncMock(return_value=stream)
    stream.__aexit__ = AsyncMock(return_value=False)
    stream.__aiter__ = MagicMock(return_value=iter(events))
    stream.get_final_message = AsyncMock(return_value=final_message)

    async def _aiter():
        for e in events:
            yield e

    stream.__aiter__ = _aiter
    return stream


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stream_chat_text_only(workspace, db):
    """Pure text response — no tools. Saves user+assistant messages, yields tokens+done."""
    events = [_make_text_event("Hello "), _make_text_event("world")]
    final = _make_final_message(100, 10)

    mock_stream = _mock_stream(events, final)

    with patch("app.services.claude.anthropic_client.messages.stream", return_value=mock_stream):
        chunks = []
        async for chunk in stream_chat(
            workspace_id=workspace.id,
            node_id="node-1",
            user_content="Hi",
            connected_node_ids=[],
            model="claude-sonnet-4-6",
            db=db,
        ):
            chunks.append(chunk)

    # Parse SSE lines
    events_data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]

    token_events = [e for e in events_data if e["type"] == "token"]
    done_events = [e for e in events_data if e["type"] == "done"]

    assert len(token_events) == 2
    assert token_events[0]["text"] == "Hello "
    assert token_events[1]["text"] == "world"
    assert len(done_events) == 1
    assert done_events[0]["usage"]["input_tokens"] == 100

    # Verify DB: 1 user message + 1 assistant message
    msgs = list((await db.execute(select(Message).order_by(Message.created_at))).scalars().all())
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].content == "Hi"
    assert msgs[1].role == "assistant"
    assert msgs[1].content == "Hello world"


@pytest.mark.asyncio
async def test_stream_chat_yields_tool_start_event(workspace, db):
    """When Claude calls a tool, tool_start SSE is yielded."""
    tool_id = "toolu_abc"
    events_first = [
        _make_tool_start_event(tool_id, "suggest_branch"),
        _make_partial_json_event('{"title": "CNNs", "reason": "more depth"}'),
    ]
    final_first = _make_final_message(50, 20)

    # Second stream (follow-up after tool) — empty text response
    events_second = [_make_text_event("I've suggested a branch.")]
    final_second = _make_final_message(80, 10)

    call_count = 0

    def _stream_factory(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_stream(events_first, final_first)
        return _mock_stream(events_second, final_second)

    with patch("app.services.claude.anthropic_client.messages.stream", side_effect=_stream_factory):
        chunks = []
        async for chunk in stream_chat(
            workspace_id=workspace.id,
            node_id="node-1",
            user_content="Suggest a branch",
            connected_node_ids=[],
            model="claude-sonnet-4-6",
            db=db,
        ):
            chunks.append(chunk)

    events_data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]
    types = [e["type"] for e in events_data]

    assert "tool_start" in types
    assert "tool_result" in types
    assert "done" in types

    tool_start = next(e for e in events_data if e["type"] == "tool_start")
    assert tool_start["name"] == "suggest_branch"


@pytest.mark.asyncio
async def test_sse_event_format():
    """sse_event() produces correct SSE format."""
    result = sse_event({"type": "token", "text": "hello"})
    assert result == 'data: {"type": "token", "text": "hello"}\n\n'
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_claude.py -v 2>&1 | head -20
```

Expected: ImportError (`app.services.claude` not found)

- [ ] **Step 3: Create `app/services/claude.py`**

```python
# app/services/claude.py
from __future__ import annotations

import json
import uuid
from typing import AsyncGenerator, Any

import anthropic

from app.core.config import settings
from app.models.clerse import Message
from app.services.context import assemble_context
from app.services.tool_execution import execute_tool
from app.services.tools import TOOL_DEFINITIONS
from sqlalchemy.ext.asyncio import AsyncSession

anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_chat(
    workspace_id: uuid.UUID,
    node_id: str,
    user_content: str,
    connected_node_ids: list[str],
    model: str,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    # 1. Save user message
    user_msg = Message(
        workspace_id=workspace_id,
        node_id=node_id,
        role="user",
        content=user_content,
    )
    db.add(user_msg)
    await db.commit()

    # 2. Assemble context
    system_prompt, messages, context_truncated = await assemble_context(
        workspace_id, node_id, connected_node_ids, db
    )

    # 3. First stream — may include tool calls
    accumulated_text, tool_calls, assistant_content_blocks, usage = await _run_stream(
        model=model,
        system_prompt=system_prompt,
        messages=messages,
        yield_fn=None,  # collect, not yield yet — we yield inline below
    )

    # Re-run as async generator to actually yield events
    accumulated_text = ""
    tool_calls: list[dict[str, Any]] = []
    assistant_content_blocks: list[dict] = []
    usage = None

    async with anthropic_client.messages.stream(
        model=model,
        max_tokens=settings.ANTHROPIC_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
        tools=TOOL_DEFINITIONS,
    ) as stream:
        async for event in stream:
            if (
                event.type == "content_block_start"
                and hasattr(event, "content_block")
                and event.content_block.type == "tool_use"
            ):
                yield sse_event({"type": "tool_start", "name": event.content_block.name})
                tool_calls.append({
                    "id": event.content_block.id,
                    "name": event.content_block.name,
                    "input": "",
                })
                assistant_content_blocks.append({
                    "type": "tool_use",
                    "id": event.content_block.id,
                    "name": event.content_block.name,
                    "input": {},  # filled after parse
                })

            elif event.type == "content_block_delta":
                if hasattr(event.delta, "text"):
                    accumulated_text += event.delta.text
                    yield sse_event({"type": "token", "text": event.delta.text})
                    if not tool_calls:
                        # Only track text blocks when not in a tool_use block
                        pass
                elif hasattr(event.delta, "partial_json") and tool_calls:
                    tool_calls[-1]["input"] += event.delta.partial_json

        final_msg = await stream.get_final_message()
        usage = final_msg.usage

    # 4. Execute tools OUTSIDE the stream loop
    tool_results: list[dict] = []
    for tc in tool_calls:
        try:
            parsed_input = json.loads(tc["input"]) if tc["input"] else {}
        except json.JSONDecodeError:
            parsed_input = {}
        tc["input"] = parsed_input

        # Patch assistant_content_blocks input
        for block in assistant_content_blocks:
            if block.get("id") == tc["id"]:
                block["input"] = parsed_input

        result = await execute_tool(tc["name"], parsed_input, workspace_id, node_id, db)
        tool_results.append({"tool_call_id": tc["id"], "result": result})
        yield sse_event({"type": "tool_result", "name": tc["name"], **result})

    # 5. Follow-up stream if tools were used
    if tool_calls:
        # Build tool result message for Anthropic
        tool_result_content = [
            {
                "type": "tool_result",
                "tool_use_id": tr["tool_call_id"],
                "content": json.dumps(tr["result"]),
            }
            for tr in tool_results
        ]

        followup_messages = messages + [
            {
                "role": "assistant",
                "content": assistant_content_blocks if assistant_content_blocks else accumulated_text or " ",
            },
            {"role": "user", "content": tool_result_content},
        ]

        async with anthropic_client.messages.stream(
            model=model,
            max_tokens=settings.ANTHROPIC_MAX_TOKENS,
            system=system_prompt,
            messages=followup_messages,
            tools=TOOL_DEFINITIONS,
        ) as stream2:
            async for event in stream2:
                if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                    accumulated_text += event.delta.text
                    yield sse_event({"type": "token", "text": event.delta.text})
            final_msg2 = await stream2.get_final_message()
            usage = final_msg2.usage

    # 6. Save assistant message
    assistant_msg = Message(
        workspace_id=workspace_id,
        node_id=node_id,
        role="assistant",
        content=accumulated_text or None,
    )
    db.add(assistant_msg)
    await db.commit()

    # 7. Done event
    yield sse_event({
        "type": "done",
        "message_id": str(assistant_msg.id),
        "usage": {
            "input_tokens": usage.input_tokens if usage else 0,
            "output_tokens": usage.output_tokens if usage else 0,
        },
        "context_truncated": context_truncated,
    })
```

- [ ] **Step 4: Run tests**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_claude.py -v
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/claude.py tests/test_claude.py
git commit -m "feat: implement stream_chat SSE generator with tool execution loop"
```

---

## Task 4: Chat Router

**Files:**
- Create: `app/routers/chat.py`
- Create: `tests/test_chat_router.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_chat_router.py`:

```python
import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app


def _mock_stream_chat(*args, **kwargs):
    """Async generator that yields two SSE events."""
    async def _gen():
        yield 'data: {"type": "token", "text": "hi"}\n\n'
        yield 'data: {"type": "done", "message_id": "abc", "usage": {"input_tokens": 1, "output_tokens": 1}, "context_truncated": false}\n\n'
    return _gen()


def test_chat_endpoint_streams_sse(workspace):
    with patch("app.routers.chat.stream_chat", side_effect=_mock_stream_chat):
        client = TestClient(app)
        response = client.post(
            "/api/chat",
            json={
                "workspace_id": str(workspace.id),
                "node_id": "node-1",
                "content": "Hello",
                "model": "claude-sonnet-4-6",
                "connected_node_ids": [],
            },
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [l for l in response.text.splitlines() if l.startswith("data: ")]
    assert len(lines) == 2
    token = json.loads(lines[0].removeprefix("data: "))
    assert token["type"] == "token"
    assert token["text"] == "hi"
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_chat_router.py -v 2>&1 | head -20
```

Expected: ImportError or 404 (router not mounted yet)

- [ ] **Step 3: Create `app/routers/chat.py`**

```python
# app/routers/chat.py
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import ChatRequest
from app.services.claude import stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def post_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        stream_chat(
            workspace_id=body.workspace_id,
            node_id=body.node_id,
            user_content=body.content,
            connected_node_ids=body.connected_node_ids,
            model=body.model,
            db=db,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Step 4: Mount chat router in `main.py`**

Edit `main.py` — add after the workspaces import:

```python
from app.routers import workspaces, chat
```

And after `app.include_router(workspaces.router)`:

```python
app.include_router(chat.router)
```

- [ ] **Step 5: Run test**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_chat_router.py -v
```

Expected: PASS

- [ ] **Step 6: Run all tests**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Smoke test the server starts**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m uvicorn main:app --port 8001 --timeout-graceful-shutdown 1 &
sleep 2
curl -s http://localhost:8001/ | python -m json.tool
kill %1
```

Expected: `{"app": "clerse", "status": "running"}`

- [ ] **Step 8: Commit**

```bash
git add app/routers/chat.py tests/test_chat_router.py main.py
git commit -m "feat: add POST /api/chat SSE endpoint and mount chat router"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|-----------------|------|
| Save user message before streaming | Task 3: step 1 in stream_chat |
| assemble_context() call | Task 3: step 2 in stream_chat |
| Stream from Anthropic with TOOL_DEFINITIONS | Task 3: first `async with` block |
| Yield `token` SSE events | Task 3: `content_block_delta` + text branch |
| Yield `tool_start` SSE event | Task 3: `content_block_start` + tool_use branch |
| Execute tools OUTSIDE stream loop | Task 3: after `async with` block closes |
| Yield `tool_result` SSE event | Task 3: after execute_tool() |
| Follow-up stream with tool results | Task 3: second `async with` block |
| Save assistant message | Task 3: step 6 |
| Yield `done` SSE event with message_id + usage | Task 3: step 7 |
| `create_branches` tool — Branch DB record | Task 2: _execute_create_branches |
| `create_branches` — relevant_message_indices → UUIDs | Task 2: message_id_map lookup |
| `suggest_branch` — no DB write | Task 2: pure dict return |
| `create_markdown` — File record | Task 2: _execute_create_markdown |
| `generate_flashcards` — File record with JSON | Task 2: _execute_generate_flashcards |
| `generate_quiz` — File record with JSON | Task 2: _execute_generate_quiz |
| `create_pdf_doc` — File record with LaTeX | Task 2: _execute_create_pdf_doc |
| tool_result SSE includes `nodes` + `edges` arrays | Task 2: all executors return {nodes, edges} |
| ChatRequest schema | Task 1 |
| StreamingResponse with text/event-stream | Task 4: chat router |
| Cache-Control + X-Accel-Buffering headers | Task 4: chat router |
| main.py mounts chat router at /api/chat | Task 4 |

### Placeholder Scan

No TBDs or stubs. All test files contain real test code with assertions. All implementation files contain complete function bodies.

### Type Consistency

- `execute_tool()` signature: `(name: str, input: dict, workspace_id: uuid.UUID, source_node_id: str, db: AsyncSession) -> dict[str, Any]` — used consistently in `claude.py`
- `stream_chat()` signature: `(workspace_id, node_id, user_content, connected_node_ids, model, db)` — matches `routers/chat.py` call
- `assemble_context()` returns `(str, list[dict], bool)` — matches `context.py:77`
- `sse_event()` returns `str` — used as `yield sse_event(...)` throughout
- `Message` model fields: `workspace_id`, `node_id`, `role`, `content` — all present in `models/clerse.py`
- `Branch` model fields: `workspace_id`, `parent_node_id`, `child_node_id`, `source_message_ids` — all present in `models/clerse.py`
- `File` model fields: `workspace_id`, `node_id`, `filename`, `content_type`, `content_text` — all present in `models/clerse.py`
