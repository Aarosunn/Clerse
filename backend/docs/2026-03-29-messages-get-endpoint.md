# Messages GET Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /api/workspaces/{workspace_id}/nodes/{node_id}/messages` returning conversation history ordered by `created_at`.

**Architecture:** Add a `get_node_messages` service function that queries the `messages` table filtered by `workspace_id` + `node_id`, ordered ascending by `created_at`. The router validates the workspace exists and delegates to the service. Route is added to the existing `workspaces` router (same prefix, same file).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, SQLite (tests), Neon/PostgreSQL (prod), pytest-asyncio

---

## File Structure

| File | Change |
|------|--------|
| `app/services/workspaces.py` | Add `get_node_messages()` |
| `app/routers/workspaces.py` | Add `GET /{workspace_id}/nodes/{node_id}/messages` route |
| `app/schemas/clerse.py` | `MessageResponse` already exists — no change needed |
| `tests/test_workspaces.py` | Add message endpoint tests |

---

### Task 1: Service function — `get_node_messages`

**Files:**
- Modify: `app/services/workspaces.py`
- Test: `tests/test_workspaces.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_workspaces.py`:

```python
import uuid
from app.models.clerse import Message

@pytest.mark.asyncio
async def test_get_messages_empty(client, workspace):
    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/node-abc/messages"
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_messages_ordered_by_created_at(client, workspace, db):
    import asyncio
    node_id = "node-abc"
    msg1 = Message(
        workspace_id=workspace.id, node_id=node_id,
        role="user", content="Hello"
    )
    db.add(msg1)
    await db.commit()
    await db.refresh(msg1)

    msg2 = Message(
        workspace_id=workspace.id, node_id=node_id,
        role="assistant", content="Hi there"
    )
    db.add(msg2)
    await db.commit()
    await db.refresh(msg2)

    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/{node_id}/messages"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "Hello"
    assert data[1]["role"] == "assistant"
    assert data[1]["content"] == "Hi there"
    assert "id" in data[0]
    assert "created_at" in data[0]


@pytest.mark.asyncio
async def test_get_messages_only_for_correct_node(client, workspace, db):
    node_a = "node-aaa"
    node_b = "node-bbb"
    db.add(Message(workspace_id=workspace.id, node_id=node_a, role="user", content="A"))
    db.add(Message(workspace_id=workspace.id, node_id=node_b, role="user", content="B"))
    await db.commit()

    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/{node_a}/messages"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "A"


@pytest.mark.asyncio
async def test_get_messages_workspace_not_found(client):
    response = await client.get(
        f"/api/workspaces/{uuid.uuid4()}/nodes/node-abc/messages"
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/asunaron/hackathons/Clerse/backend
.venv/bin/pytest tests/test_workspaces.py::test_get_messages_empty tests/test_workspaces.py::test_get_messages_ordered_by_created_at tests/test_workspaces.py::test_get_messages_only_for_correct_node tests/test_workspaces.py::test_get_messages_workspace_not_found -v
```

Expected: 4 FAILs with `404` or connection errors (route doesn't exist yet).

- [ ] **Step 3: Add `get_node_messages` to the service**

In `app/services/workspaces.py`, add after the existing imports and functions:

```python
from app.models.clerse import Workspace, Message

async def get_node_messages(
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == node_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())
```

Note: the existing import at line 4 is `from app.models.clerse import Workspace` — update it to also import `Message`.

- [ ] **Step 4: Add the route to the workspaces router**

In `app/routers/workspaces.py`, add the import and route:

```python
# Add to imports at top:
from app.schemas.clerse import (
    WorkspaceCreate,
    WorkspaceCreatedResponse,
    WorkspaceGetResponse,
    WorkspaceUpdate,
    WorkspaceUpdatedResponse,
    MessageResponse,
)

# Add at the bottom of the file:
@router.get("/{workspace_id}/nodes/{node_id}/messages", response_model=list[MessageResponse])
async def get_node_messages(
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace(workspace_id, db)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    messages = await workspace_service.get_node_messages(workspace_id, node_id, db)
    return messages
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/asunaron/hackathons/Clerse/backend
.venv/bin/pytest tests/test_workspaces.py::test_get_messages_empty tests/test_workspaces.py::test_get_messages_ordered_by_created_at tests/test_workspaces.py::test_get_messages_only_for_correct_node tests/test_workspaces.py::test_get_messages_workspace_not_found -v
```

Expected: 4 PASSes.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd /home/asunaron/hackathons/Clerse/backend
.venv/bin/pytest -v
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd /home/asunaron/hackathons/Clerse/backend
git add app/services/workspaces.py app/routers/workspaces.py tests/test_workspaces.py
git commit -m "feat: add GET /api/workspaces/{id}/nodes/{node_id}/messages endpoint"
```

---

## Response Shape

The endpoint returns `list[MessageResponse]` (already defined in `app/schemas/clerse.py`):

```json
[
  {"id": "uuid", "role": "user", "content": "Hello", "created_at": "2026-03-29T12:00:00Z"},
  {"id": "uuid", "role": "assistant", "content": "Hi there", "created_at": "2026-03-29T12:00:01Z"}
]
```

- `content` can be `null` for tool-call-only messages
- Ordered ascending by `created_at`
- Returns `[]` (not 404) when workspace exists but node has no messages
- Returns 404 when workspace does not exist
