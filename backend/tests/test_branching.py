# tests/test_branching.py
import uuid
import pytest
import pytest_asyncio
from sqlalchemy import select
from app.schemas.clerse import BranchCreateRequest, BranchCreateResponse
from app.models.clerse import Branch, Message, Workspace
from app.services.workspaces import create_branch, InvalidSourceMessageError


def test_branch_create_request_schema():
    msg_id_1 = uuid.uuid4()
    msg_id_2 = uuid.uuid4()
    req = BranchCreateRequest(
        source_message_ids=[msg_id_1, msg_id_2],
        title="Deep dive into CNNs",
        child_node_id="node-xyz",
    )
    assert len(req.source_message_ids) == 2
    assert req.title == "Deep dive into CNNs"
    assert req.child_node_id == "node-xyz"


def test_branch_create_response_schema():
    branch_id = uuid.uuid4()
    msg_id = uuid.uuid4()
    resp = BranchCreateResponse(
        branch_id=branch_id,
        parent_node_id="node-abc",
        child_node_id="node-xyz",
        source_message_ids=[msg_id],
    )
    assert resp.branch_id == branch_id
    assert resp.parent_node_id == "node-abc"
    assert resp.child_node_id == "node-xyz"
    assert resp.source_message_ids == [msg_id]


@pytest_asyncio.fixture
async def workspace(db):
    ws = Workspace(title="Branch Test Workspace")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


@pytest_asyncio.fixture
async def messages(db, workspace):
    msgs = [
        Message(workspace_id=workspace.id, node_id="node-parent", role="user", content="Hello"),
        Message(workspace_id=workspace.id, node_id="node-parent", role="assistant", content="World"),
    ]
    for m in msgs:
        db.add(m)
    await db.commit()
    for m in msgs:
        await db.refresh(m)
    return msgs


@pytest.mark.asyncio
async def test_create_branch_success(db, workspace, messages):
    source_ids = [messages[0].id, messages[1].id]
    branch = await create_branch(
        workspace_id=workspace.id,
        parent_node_id="node-parent",
        child_node_id="node-child",
        source_message_ids=source_ids,
        db=db,
    )
    assert branch.id is not None
    assert branch.workspace_id == workspace.id
    assert branch.parent_node_id == "node-parent"
    assert branch.child_node_id == "node-child"
    assert set(str(sid) for sid in branch.source_message_ids) == set(str(sid) for sid in source_ids)


@pytest.mark.asyncio
async def test_create_branch_persisted(db, workspace, messages):
    source_ids = [messages[0].id]
    await create_branch(
        workspace_id=workspace.id,
        parent_node_id="node-parent",
        child_node_id="node-child",
        source_message_ids=source_ids,
        db=db,
    )
    result = await db.execute(
        select(Branch).where(Branch.workspace_id == workspace.id)
    )
    records = list(result.scalars().all())
    assert len(records) == 1
    assert records[0].child_node_id == "node-child"


@pytest.mark.asyncio
async def test_create_branch_rejects_foreign_message(db, workspace, messages):
    """source_message_ids must all belong to the given node_id."""
    other_msg = Message(
        workspace_id=workspace.id,
        node_id="node-other",  # different node
        role="user",
        content="Other",
    )
    db.add(other_msg)
    await db.commit()
    await db.refresh(other_msg)

    with pytest.raises(InvalidSourceMessageError):
        await create_branch(
            workspace_id=workspace.id,
            parent_node_id="node-parent",
            child_node_id="node-child",
            source_message_ids=[other_msg.id],
            db=db,
        )


@pytest.mark.asyncio
async def test_create_branch_empty_source_ids(db, workspace):
    """Empty source_message_ids is allowed — branch off entire context."""
    branch = await create_branch(
        workspace_id=workspace.id,
        parent_node_id="node-parent",
        child_node_id="node-child",
        source_message_ids=[],
        db=db,
    )
    assert branch.id is not None
    assert branch.source_message_ids == []
