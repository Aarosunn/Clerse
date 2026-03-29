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
