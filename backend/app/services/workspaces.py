# app/services/workspaces.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import Workspace


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
