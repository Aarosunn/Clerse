# app/services/workspaces.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import Branch, Message, Workspace


async def create_workspace(title: str, db: AsyncSession) -> Workspace:
    workspace = Workspace(title=title)
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return result.scalar_one_or_none()


async def update_workspace(
    workspace_id: uuid.UUID,
    canvas_state: dict | None,
    title: str | None,
    db: AsyncSession,
) -> Workspace | None:
    workspace = await get_workspace(workspace_id, db)
    if workspace is None:
        return None
    if canvas_state is not None:
        workspace.canvas_state = canvas_state
    if title is not None:
        workspace.title = title
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession) -> bool:
    workspace = await get_workspace(workspace_id, db)
    if workspace is None:
        return False
    await db.delete(workspace)
    await db.commit()
    return True


async def get_node_messages(
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == node_id)
        .order_by(Message.created_at, Message.id)
    )
    return list(result.scalars().all())


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
        result = await db.execute(
            select(Message).where(
                Message.id.in_(source_message_ids),
                Message.workspace_id == workspace_id,
                Message.node_id == parent_node_id,
            )
        )
        found = list(result.scalars().all())
        if len(found) != len(source_message_ids):
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
