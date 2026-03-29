# Branching Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/workspaces/{workspace_id}/nodes/{node_id}/branch` so users can create branch records pointing a parent node to a child node with selected source messages.

**Architecture:** The endpoint accepts a JSON body with `source_message_ids` and `child_node_id`. It validates that every `source_message_id` belongs to the given `node_id` within the workspace, then creates a `branches` row. The `child_node_id` is supplied by the frontend (it creates the node in Liveblocks). The endpoint lives in `app/routers/workspaces.py` and delegates to `app/services/workspaces.py`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Pydantic, existing `Branch` and `Message` ORM models in `app/models/clerse.py`

**Note:** `title` was intentionally excluded from the request body — the `branches` table has no title column and the canvas node title is managed by Liveblocks on the frontend.

---

### Task 1: Schemas for branch create/response ✅

**Files:**
- Modified: `app/schemas/clerse.py`

```python
class BranchCreateRequest(BaseModel):
    source_message_ids: list[uuid.UUID]
    child_node_id: str


class BranchCreateResponse(BaseModel):
    branch_id: uuid.UUID
    parent_node_id: str
    child_node_id: str
    source_message_ids: list[uuid.UUID]

    model_config = {"from_attributes": True}
```

---

### Task 2: Branch service function ✅

**Files:**
- Modified: `app/services/workspaces.py`

```python
class InvalidSourceMessageError(ValueError):
    """Raised when a source_message_id does not belong to the given node."""


async def create_branch(
    workspace_id: uuid.UUID,
    parent_node_id: str,
    child_node_id: str,
    source_message_ids: list[uuid.UUID],
    db: AsyncSession,
) -> Branch:
    if source_message_ids:
        unique_ids = list(dict.fromkeys(source_message_ids))  # deduplicate, preserve order
        result = await db.execute(
            select(Message).where(
                Message.id.in_(unique_ids),
                Message.workspace_id == workspace_id,
                Message.node_id == parent_node_id,
            )
        )
        found = list(result.scalars().all())
        if len(found) != len(unique_ids):
            raise InvalidSourceMessageError(
                "One or more source_message_ids do not belong to the given node_id."
            )

    branch = Branch(
        workspace_id=workspace_id,
        parent_node_id=parent_node_id,
        child_node_id=child_node_id,
        source_message_ids=[str(mid) for mid in source_message_ids],
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch
```

**Key decisions:**
- Deduplicates `source_message_ids` with `dict.fromkeys` before validation to avoid false rejections on duplicate inputs
- Stores as `list[str]` in JSONB (UUIDs serialized to strings)
- Empty `source_message_ids` is allowed — branches off entire context

---

### Task 3: Branch router endpoint ✅

**Files:**
- Modified: `app/routers/workspaces.py`

Endpoint:
- Checks workspace exists → 404
- Catches `InvalidSourceMessageError` → 422
- Returns `BranchCreateResponse` with 201

Response is manually constructed — `branch.source_message_ids` is `list[str]` in JSONB, must convert back to UUID objects:

```python
return BranchCreateResponse(
    branch_id=branch.id,
    parent_node_id=branch.parent_node_id,
    child_node_id=branch.child_node_id,
    source_message_ids=[uuid.UUID(mid) for mid in (branch.source_message_ids or [])],
)
```
