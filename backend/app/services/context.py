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
