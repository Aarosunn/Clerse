import base64
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import File


async def upload_file(
    workspace_id: uuid.UUID,
    node_id: str,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    db: AsyncSession,
) -> File:
    file_record = File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=filename,
        content_type=content_type,
        file_data=base64.b64encode(file_bytes).decode("utf-8"),
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)
    return file_record
