# tests/test_context.py
import uuid
import pytest
from app.models.clerse import Workspace, Message, File
from app.services.context import get_node_messages, get_node_file, find_node_in_canvas, assemble_context


@pytest.mark.asyncio
async def test_get_node_messages_empty(db):
    ws = Workspace(title="WS")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    msgs = await get_node_messages(ws.id, "node-1", db)
    assert msgs == []


@pytest.mark.asyncio
async def test_get_node_messages_returns_in_order(db):
    ws = Workspace(title="WS")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    m1 = Message(workspace_id=ws.id, node_id="node-1", role="user", content="hello")
    m2 = Message(workspace_id=ws.id, node_id="node-1", role="assistant", content="hi")
    db.add_all([m1, m2])
    await db.commit()

    msgs = await get_node_messages(ws.id, "node-1", db)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


@pytest.mark.asyncio
async def test_get_node_messages_only_own_node(db):
    ws = Workspace(title="WS")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    m1 = Message(workspace_id=ws.id, node_id="node-1", role="user", content="mine")
    m2 = Message(workspace_id=ws.id, node_id="node-2", role="user", content="other")
    db.add_all([m1, m2])
    await db.commit()

    msgs = await get_node_messages(ws.id, "node-1", db)
    assert len(msgs) == 1
    assert msgs[0].content == "mine"


@pytest.mark.asyncio
async def test_get_node_file_not_found(db):
    ws = Workspace(title="WS")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    result = await get_node_file(ws.id, "node-x", db)
    assert result is None


@pytest.mark.asyncio
async def test_get_node_file_found(db):
    ws = Workspace(title="WS")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-pdf",
        filename="doc.pdf",
        content_type="application/pdf",
        content_text="page 1 text",
    )
    db.add(f)
    await db.commit()

    result = await get_node_file(ws.id, "node-pdf", db)
    assert result is not None
    assert result.content_text == "page 1 text"



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
async def test_assemble_context_chat_only(db):
    canvas = {
        "nodes": [{"id": "node-1", "type": "chat", "data": {"skill": "Default"}}],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    m = Message(workspace_id=ws.id, node_id="node-1", role="user", content="hello")
    db.add(m)
    await db.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-1", connected_node_ids=[], db=db
    )

    assert "helpful AI assistant" in system
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "hello"
    assert truncated is False


@pytest.mark.asyncio
async def test_assemble_context_uses_skill_prompt(db):
    canvas = {
        "nodes": [{"id": "node-1", "type": "chat", "data": {"skill": "Tutor"}}],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    system, messages, truncated = await assemble_context(
        ws.id, "node-1", connected_node_ids=[], db=db
    )

    assert "tutor" in system.lower()


@pytest.mark.asyncio
async def test_assemble_context_injects_text_node_into_system(db):
    canvas = {
        "nodes": [
            {"id": "node-chat", "type": "chat", "data": {"skill": "Default"}},
            {"id": "node-text", "type": "text", "data": {"title": "Notes"}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-text",
        content_type="text/plain",
        content_text="important reference content",
    )
    db.add(f)
    await db.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-chat", connected_node_ids=["node-text"], db=db
    )

    assert "important reference content" in system
    assert "Notes" in system


@pytest.mark.asyncio
async def test_assemble_context_merges_linked_chat_messages(db):
    canvas = {
        "nodes": [
            {"id": "node-a", "type": "chat", "data": {}},
            {"id": "node-b", "type": "chat", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    m_a = Message(workspace_id=ws.id, node_id="node-a", role="user", content="from a")
    m_b = Message(workspace_id=ws.id, node_id="node-b", role="user", content="from b")
    db.add_all([m_a, m_b])
    await db.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-b", connected_node_ids=["node-a"], db=db
    )

    contents = [m["content"] for m in messages]
    assert "from a" in contents
    assert "from b" in contents


@pytest.mark.asyncio
async def test_assemble_context_prepends_image_block(db):
    canvas = {
        "nodes": [
            {"id": "node-chat", "type": "chat", "data": {}},
            {"id": "node-img", "type": "image", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    f = File(
        workspace_id=ws.id,
        node_id="node-img",
        content_type="image/png",
        file_data="base64encodeddata==",
    )
    m = Message(workspace_id=ws.id, node_id="node-chat", role="user", content="describe this")
    db.add_all([f, m])
    await db.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-chat", connected_node_ids=["node-img"], db=db
    )

    # First user message content should be a list with image block + text block
    first_user = next(m for m in messages if m["role"] == "user")
    assert isinstance(first_user["content"], list)
    block_types = [b["type"] for b in first_user["content"]]
    assert "image" in block_types
    assert "text" in block_types


@pytest.mark.asyncio
async def test_assemble_context_truncates_linked_messages(db):
    canvas = {
        "nodes": [
            {"id": "node-a", "type": "chat", "data": {}},
            {"id": "node-b", "type": "chat", "data": {}},
        ],
        "edges": [],
    }
    ws = Workspace(title="WS", canvas_state=canvas)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    # Add 80 messages to linked node-a and 80 to own node-b → total 160 > 150
    for i in range(80):
        db.add(Message(workspace_id=ws.id, node_id="node-a", role="user", content=f"a{i}"))
        db.add(Message(workspace_id=ws.id, node_id="node-b", role="user", content=f"b{i}"))
    await db.commit()

    system, messages, truncated = await assemble_context(
        ws.id, "node-b", connected_node_ids=["node-a"], db=db
    )

    assert truncated is True
    # Linked messages are capped at 10, own messages (80) kept in full
    assert len(messages) <= 90
