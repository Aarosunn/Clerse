# Skills, Context Assembly, and Tool Definitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `services/skills.py` (system prompt variants), `services/context.py` (context assembly engine), and `services/tools.py` (Anthropic tool definitions) so the chat endpoint can produce correctly assembled prompts and tool-augmented Claude calls.

**Architecture:** Skills provides a `get_skill_prompt(skill)` lookup; context assembly queries DB for messages and files from connected nodes, builds the Anthropic messages list and system prompt, and returns a `(system, messages, truncated)` tuple; tools defines the JSON schema list passed to the Anthropic SDK. All three are pure service-layer modules — no HTTP concerns.

**Tech Stack:** Python 3.12, SQLAlchemy 2.0 async, Anthropic SDK, pytest-asyncio, SQLite in-memory for tests (via existing conftest.py pattern)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/services/skills.py` | `SKILLS` dict + `get_skill_prompt(skill)` |
| Create | `app/services/tools.py` | `TOOL_DEFINITIONS` list of Anthropic JSON schemas |
| Create | `app/services/context.py` | `assemble_context(...)` — queries DB, builds system + messages |
| Create | `tests/test_skills.py` | Unit tests for skills lookup |
| Create | `tests/test_tools.py` | Unit tests for tool schema structure |
| Create | `tests/test_context.py` | Integration tests for context assembly against in-memory DB |

---

## Task 1: Skills Service

**Files:**
- Create: `app/services/skills.py`
- Create: `tests/test_skills.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_skills.py
import pytest
from app.services.skills import get_skill_prompt, SKILLS


def test_default_skill_returns_prompt():
    prompt = get_skill_prompt("Default")
    assert "helpful AI assistant" in prompt
    assert len(prompt) > 20


def test_tutor_skill():
    prompt = get_skill_prompt("Tutor")
    assert "tutor" in prompt.lower()


def test_socratic_skill():
    prompt = get_skill_prompt("Socratic")
    assert "question" in prompt.lower()


def test_research_assistant_skill():
    prompt = get_skill_prompt("Research Assistant")
    assert "research" in prompt.lower()


def test_brainstorm_skill():
    prompt = get_skill_prompt("Brainstorm")
    assert "brainstorm" in prompt.lower() or "creative" in prompt.lower()


def test_unknown_skill_falls_back_to_default():
    prompt = get_skill_prompt("NonExistentSkill")
    assert prompt == get_skill_prompt("Default")


def test_none_skill_falls_back_to_default():
    prompt = get_skill_prompt(None)
    assert prompt == get_skill_prompt("Default")


def test_all_skills_are_strings():
    for name, prompt in SKILLS.items():
        assert isinstance(name, str)
        assert isinstance(prompt, str)
        assert len(prompt) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/asunaron/hackathons/Clerse/backend
source .venv/bin/activate
pytest tests/test_skills.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.skills'`

- [ ] **Step 3: Implement `app/services/skills.py`**

```python
# app/services/skills.py
from __future__ import annotations

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


def get_skill_prompt(skill: str | None) -> str:
    """Return the system prompt for the given skill name. Falls back to Default."""
    return SKILLS.get(skill or "Default", SKILLS["Default"])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_skills.py -v
```

Expected: 8 PASSED

- [ ] **Step 5: Commit**

```bash
git add app/services/skills.py tests/test_skills.py
git commit -m "feat: add skills service with system prompt variants"
```

---

## Task 2: Tool Definitions

**Files:**
- Create: `app/services/tools.py`
- Create: `tests/test_tools.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_tools.py
import pytest
from app.services.tools import TOOL_DEFINITIONS


def test_tool_definitions_is_list():
    assert isinstance(TOOL_DEFINITIONS, list)
    assert len(TOOL_DEFINITIONS) == 6


def test_each_tool_has_required_keys():
    for tool in TOOL_DEFINITIONS:
        assert "name" in tool
        assert "description" in tool
        assert "input_schema" in tool
        assert tool["input_schema"]["type"] == "object"
        assert "properties" in tool["input_schema"]
        assert "required" in tool["input_schema"]


def test_tool_names():
    names = [t["name"] for t in TOOL_DEFINITIONS]
    assert "create_branches" in names
    assert "suggest_branch" in names
    assert "create_markdown" in names
    assert "generate_flashcards" in names
    assert "generate_quiz" in names
    assert "create_pdf_doc" in names


def test_create_branches_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "create_branches")
    schema = tool["input_schema"]
    assert "branches" in schema["properties"]
    branches_prop = schema["properties"]["branches"]
    assert branches_prop["type"] == "array"
    assert branches_prop["minItems"] == 2
    assert branches_prop["maxItems"] == 4
    item_props = branches_prop["items"]["properties"]
    assert "title" in item_props
    assert "rationale" in item_props
    assert "relevant_message_indices" in item_props


def test_generate_flashcards_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "generate_flashcards")
    schema = tool["input_schema"]
    assert "title" in schema["properties"]
    assert "cards" in schema["properties"]
    card_props = schema["properties"]["cards"]["items"]["properties"]
    assert "front" in card_props
    assert "back" in card_props


def test_generate_quiz_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "generate_quiz")
    schema = tool["input_schema"]
    assert "questions" in schema["properties"]
    q_props = schema["properties"]["questions"]["items"]["properties"]
    assert "question" in q_props
    assert "options" in q_props
    assert "correct_answer" in q_props
    assert "explanation" in q_props
    assert q_props["options"]["minItems"] == 4
    assert q_props["options"]["maxItems"] == 4
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_tools.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.tools'`

- [ ] **Step 3: Implement `app/services/tools.py`**

```python
# app/services/tools.py

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "create_branches",
        "description": "Create 2-4 parallel conversation branches exploring different angles of the current topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branches": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "rationale": {"type": "string"},
                            "relevant_message_indices": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "description": "0-based indices of messages most relevant to this branch",
                            },
                        },
                        "required": ["title"],
                    },
                }
            },
            "required": ["branches"],
        },
    },
    {
        "name": "suggest_branch",
        "description": "Suggest a branch topic without creating it. User must confirm in the UI.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["title", "reason"],
        },
    },
    {
        "name": "create_markdown",
        "description": (
            "Save content (summary, notes, code, explanation) as a persistent artifact node "
            "on the canvas. Use Markdown + KaTeX for formatting."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {
                    "type": "string",
                    "description": "Markdown + KaTeX content",
                },
            },
            "required": ["title", "content"],
        },
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
                            "back": {"type": "string"},
                        },
                        "required": ["front", "back"],
                    },
                },
            },
            "required": ["title", "cards"],
        },
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
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 4,
                                "maxItems": 4,
                            },
                            "correct_answer": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["question", "options", "correct_answer", "explanation"],
                    },
                },
            },
            "required": ["title", "questions"],
        },
    },
    {
        "name": "create_pdf_doc",
        "description": "Generate a formatted document as a PDF doc node. Use LaTeX for the content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {
                    "type": "string",
                    "description": "LaTeX document content",
                },
            },
            "required": ["title", "content"],
        },
    },
]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_tools.py -v
```

Expected: 7 PASSED

- [ ] **Step 5: Commit**

```bash
git add app/services/tools.py tests/test_tools.py
git commit -m "feat: add tool definitions for Claude canvas tools"
```

---

## Task 3: Context Assembly — Helper Queries

The context assembly engine needs two DB query helpers before the main `assemble_context` function. Build and test them first.

**Files:**
- Create: `app/services/context.py` (partial — helpers only)
- Create: `tests/test_context.py` (partial)

- [ ] **Step 1: Write the failing tests for DB helpers**

```python
# tests/test_context.py
import uuid
import pytest
from app.models.clerse import Workspace, Message, File
from app.services.context import get_node_messages, get_node_file


@pytest.mark.asyncio
async def test_get_node_messages_empty(db_session):
    ws = Workspace(title="WS")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    msgs = await get_node_messages(ws.id, "node-1", db_session)
    assert msgs == []


@pytest.mark.asyncio
async def test_get_node_messages_returns_in_order(db_session):
    ws = Workspace(title="WS")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    m1 = Message(workspace_id=ws.id, node_id="node-1", role="user", content="hello")
    m2 = Message(workspace_id=ws.id, node_id="node-1", role="assistant", content="hi")
    db_session.add_all([m1, m2])
    await db_session.commit()

    msgs = await get_node_messages(ws.id, "node-1", db_session)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


@pytest.mark.asyncio
async def test_get_node_messages_only_own_node(db_session):
    ws = Workspace(title="WS")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    m1 = Message(workspace_id=ws.id, node_id="node-1", role="user", content="mine")
    m2 = Message(workspace_id=ws.id, node_id="node-2", role="user", content="other")
    db_session.add_all([m1, m2])
    await db_session.commit()

    msgs = await get_node_messages(ws.id, "node-1", db_session)
    assert len(msgs) == 1
    assert msgs[0].content == "mine"


@pytest.mark.asyncio
async def test_get_node_file_not_found(db_session):
    ws = Workspace(title="WS")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    result = await get_node_file(ws.id, "node-x", db_session)
    assert result is None


@pytest.mark.asyncio
async def test_get_node_file_found(db_session):
    ws = Workspace(title="WS")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-pdf",
        filename="doc.pdf",
        content_type="application/pdf",
        content_text="page 1 text",
    )
    db_session.add(f)
    await db_session.commit()

    result = await get_node_file(ws.id, "node-pdf", db_session)
    assert result is not None
    assert result.content_text == "page 1 text"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_context.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.context'`

- [ ] **Step 3: Implement helpers in `app/services/context.py`**

```python
# app/services/context.py
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import File, Message, Workspace


async def get_node_messages(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> list[Message]:
    """Return all messages for a node, ordered oldest first."""
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == node_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def get_node_file(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> File | None:
    """Return the file record for a node, or None."""
    result = await db.execute(
        select(File)
        .where(File.workspace_id == workspace_id, File.node_id == node_id)
        .limit(1)
    )
    return result.scalar_one_or_none()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_context.py -v
```

Expected: 5 PASSED

- [ ] **Step 5: Commit**

```bash
git add app/services/context.py tests/test_context.py
git commit -m "feat: add context service helpers — get_node_messages, get_node_file"
```

---

## Task 4: Context Assembly — `find_node_in_canvas` and `assemble_context`

**Files:**
- Modify: `app/services/context.py` (add `find_node_in_canvas`, `build_file_block`, `assemble_context`)
- Modify: `tests/test_context.py` (add tests)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_context.py`:

```python
from app.services.context import find_node_in_canvas, assemble_context


# --- find_node_in_canvas ---

def test_find_node_returns_node():
    canvas = {
        "nodes": [
            {"id": "n1", "type": "chat", "data": {"skill": "Tutor"}},
            {"id": "n2", "type": "pdf", "data": {}},
        ]
    }
    node = find_node_in_canvas(canvas, "n1")
    assert node is not None
    assert node["id"] == "n1"


def test_find_node_returns_none_when_missing():
    canvas = {"nodes": [{"id": "n1", "type": "chat", "data": {}}]}
    assert find_node_in_canvas(canvas, "nX") is None


def test_find_node_handles_none_canvas():
    assert find_node_in_canvas(None, "n1") is None


def test_find_node_handles_empty_nodes():
    assert find_node_in_canvas({"nodes": []}, "n1") is None


# --- assemble_context: minimal chat-only case ---

@pytest.mark.asyncio
async def test_assemble_context_chat_only(db_session):
    canvas = {
        "nodes": [{"id": "node-1", "type": "chat", "data": {"skill": "Default"}}],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    m = Message(workspace_id=ws.id, node_id="node-1", role="user", content="hello")
    db_session.add(m)
    await db_session.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-1", connected_node_ids=[], db=db_session
    )

    assert "helpful AI assistant" in system
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "hello"
    assert truncated is False


@pytest.mark.asyncio
async def test_assemble_context_uses_skill_prompt(db_session):
    canvas = {
        "nodes": [{"id": "node-1", "type": "chat", "data": {"skill": "Tutor"}}],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    system, messages, truncated = await assemble_context(
        ws.id, "node-1", connected_node_ids=[], db=db_session
    )

    assert "tutor" in system.lower()


@pytest.mark.asyncio
async def test_assemble_context_injects_text_node_into_system(db_session):
    canvas = {
        "nodes": [
            {"id": "node-chat", "type": "chat", "data": {"skill": "Default"}},
            {"id": "node-text", "type": "text", "data": {"title": "Notes"}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-text",
        content_type="text/plain",
        content_text="important reference content",
    )
    db_session.add(f)
    await db_session.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-chat", connected_node_ids=["node-text"], db=db_session
    )

    assert "important reference content" in system
    assert "Notes" in system


@pytest.mark.asyncio
async def test_assemble_context_merges_linked_chat_messages(db_session):
    canvas = {
        "nodes": [
            {"id": "node-a", "type": "chat", "data": {}},
            {"id": "node-b", "type": "chat", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    m_a = Message(workspace_id=ws.id, node_id="node-a", role="user", content="from a")
    m_b = Message(workspace_id=ws.id, node_id="node-b", role="user", content="from b")
    db_session.add_all([m_a, m_b])
    await db_session.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-b", connected_node_ids=["node-a"], db=db_session
    )

    contents = [m["content"] for m in messages]
    assert "from a" in contents
    assert "from b" in contents


@pytest.mark.asyncio
async def test_assemble_context_prepends_image_block(db_session):
    canvas = {
        "nodes": [
            {"id": "node-chat", "type": "chat", "data": {}},
            {"id": "node-img", "type": "image", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-img",
        content_type="image/png",
        file_data="base64encodeddata==",
    )
    m = Message(workspace_id=ws.id, node_id="node-chat", role="user", content="describe this")
    db_session.add_all([f, m])
    await db_session.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-chat", connected_node_ids=["node-img"], db=db_session
    )

    # First user message content should be a list with image block + text block
    first_user = next(m for m in messages if m["role"] == "user")
    assert isinstance(first_user["content"], list)
    block_types = [b["type"] for b in first_user["content"]]
    assert "image" in block_types
    assert "text" in block_types


@pytest.mark.asyncio
async def test_assemble_context_truncates_linked_messages(db_session):
    canvas = {
        "nodes": [
            {"id": "node-a", "type": "chat", "data": {}},
            {"id": "node-b", "type": "chat", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    # Add 80 messages to linked node-a and 80 to own node-b → total 160 > 150
    for i in range(80):
        db_session.add(Message(workspace_id=ws.id, node_id="node-a", role="user", content=f"a{i}"))
        db_session.add(Message(workspace_id=ws.id, node_id="node-b", role="user", content=f"b{i}"))
    await db_session.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-b", connected_node_ids=["node-a"], db=db_session
    )

    assert truncated is True
    # Linked messages are capped at 10, own messages (80) kept in full
    assert len(messages) <= 90
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_context.py -v
```

Expected: all new tests FAIL with `ImportError` or `AttributeError`

- [ ] **Step 3: Implement remaining functions in `app/services/context.py`**

Replace the entire file contents:

```python
# app/services/context.py
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import File, Message, Workspace
from app.services.skills import get_skill_prompt

# Node types whose file content goes into the system prompt as reference text
_SYSTEM_PROMPT_NODE_TYPES = {"text", "article", "youtube"}

# Node types whose file data is injected as a block in the first user message
_BLOCK_NODE_TYPES = {"image", "pdf"}


async def get_node_messages(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> list[Message]:
    """Return all messages for a node, ordered oldest first."""
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == node_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def get_node_file(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> File | None:
    """Return the file record for a node, or None."""
    result = await db.execute(
        select(File)
        .where(File.workspace_id == workspace_id, File.node_id == node_id)
        .limit(1)
    )
    return result.scalar_one_or_none()


def find_node_in_canvas(canvas_state: dict | None, node_id: str) -> dict | None:
    """Find a node dict in canvas_state["nodes"] by id. Returns None if not found."""
    if not canvas_state:
        return None
    for node in canvas_state.get("nodes", []):
        if node.get("id") == node_id:
            return node
    return None


def build_file_block(file: File) -> dict:
    """Build an Anthropic content block for an image or PDF file."""
    if file.content_type and file.content_type.startswith("image/"):
        media_type = file.content_type  # e.g. "image/png"
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": file.file_data or "",
            },
        }
    # PDF — treated as a document block
    return {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": file.file_data or "",
        },
    }


async def assemble_context(
    workspace_id: uuid.UUID,
    node_id: str,
    connected_node_ids: list[str],
    db: AsyncSession,
) -> tuple[str, list[dict], bool]:
    """
    Assemble the system prompt and Anthropic messages list for a Claude call.

    Returns:
        (system_prompt, anthropic_messages, context_truncated)
    """
    # 1. Resolve skill from canvas_state
    workspace = await db.get(Workspace, workspace_id)
    canvas = workspace.canvas_state if workspace else None
    node_data = find_node_in_canvas(canvas, node_id)
    skill = node_data.get("data", {}).get("skill") if node_data else None
    system = get_skill_prompt(skill)

    # 2. Gather connected node contributions
    prepend_blocks: list[dict] = []      # image/pdf blocks for first user message
    artifact_refs: list[str] = []        # text snippets for system prompt
    linked_messages: list[Message] = []  # chat history from linked chat nodes

    for linked_id in connected_node_ids:
        linked_node = find_node_in_canvas(canvas, linked_id)
        if not linked_node:
            continue
        node_type = linked_node.get("type", "")

        if node_type == "chat":
            msgs = await get_node_messages(workspace_id, linked_id, db)
            linked_messages.extend(msgs)

        elif node_type in _BLOCK_NODE_TYPES:
            file = await get_node_file(workspace_id, linked_id, db)
            if file:
                prepend_blocks.append(build_file_block(file))

        elif node_type in _SYSTEM_PROMPT_NODE_TYPES:
            file = await get_node_file(workspace_id, linked_id, db)
            if file and file.content_text:
                title = linked_node.get("data", {}).get("title", "Context")
                artifact_refs.append(f"## {title}\n{file.content_text}")

    # 3. Append reference material to system prompt
    if artifact_refs:
        system += "\n\n---\nReference material:\n" + "\n\n".join(artifact_refs)

    # 4. Fetch own messages
    own_messages = await get_node_messages(workspace_id, node_id, db)

    # 5. Truncate linked messages if total is excessive
    total = len(linked_messages) + len(own_messages)
    context_truncated = total > 150
    if context_truncated:
        linked_messages = linked_messages[-10:]

    # 6. Build sorted Anthropic messages list
    all_messages = sorted(linked_messages + own_messages, key=lambda m: m.created_at)
    messages: list[dict[str, Any]] = []
    for msg in all_messages:
        messages.append({"role": msg.role, "content": msg.content or ""})

    # 7. Prepend file blocks into first user message
    if prepend_blocks and messages:
        for i, m in enumerate(messages):
            if m["role"] == "user":
                messages[i] = {
                    "role": "user",
                    "content": prepend_blocks + [{"type": "text", "text": m["content"]}],
                }
                break

    return system, messages, context_truncated
```

- [ ] **Step 4: Run all context tests**

```bash
pytest tests/test_context.py -v
```

Expected: all tests PASS (including the 5 from Task 3)

- [ ] **Step 5: Run the full test suite to verify nothing is broken**

```bash
pytest -v
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/context.py tests/test_context.py
git commit -m "feat: implement context assembly engine — assemble_context, find_node_in_canvas, build_file_block"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|------------------|------------|
| `services/skills.py` with all 5 skill variants | Task 1 |
| `get_skill_prompt(skill)` fallback to Default | Task 1, `test_unknown_skill_falls_back_to_default` |
| `services/tools.py` — all 6 tool definitions | Task 2 |
| `create_branches` schema (2-4, `relevant_message_indices`) | Task 2, `test_create_branches_schema` |
| Flashcard/quiz schema detail | Task 2 |
| `services/context.py` — `assemble_context` | Task 4 |
| One-hop only (connected_node_ids from request) | Task 4 (function signature) |
| text/article/youtube → system prompt reference | Task 4, `test_assemble_context_injects_text_node_into_system` |
| image/pdf → prepend_blocks in first user message | Task 4, `test_assemble_context_prepends_image_block` |
| linked chat → messages list | Task 4, `test_assemble_context_merges_linked_chat_messages` |
| Truncation >150 messages | Task 4, `test_assemble_context_truncates_linked_messages` |
| Skill resolved from canvas_state node data | Task 4, `test_assemble_context_uses_skill_prompt` |

### Type consistency check

- `get_node_messages` returns `list[Message]` — used consistently in Task 3 and Task 4
- `get_node_file` returns `File | None` — consistent in Task 3 and Task 4
- `find_node_in_canvas` returns `dict | None` — used in Task 4 `assemble_context`
- `build_file_block` takes `File`, returns `dict` — used in Task 4
- `assemble_context` signature: `(uuid.UUID, str, list[str], AsyncSession) -> tuple[str, list[dict], bool]` — consistent throughout
- `get_skill_prompt` from Task 1 called with `skill: str | None` — `node_data.get("data", {}).get("skill")` returns `str | None` ✓
