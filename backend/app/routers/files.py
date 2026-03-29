# app/routers/files.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import FileUploadResponse
from app.services import files as files_service
from app.services import workspaces as workspace_service

router = APIRouter(prefix="/api/workspaces", tags=["files"])

_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/{workspace_id}/files", status_code=201, response_model=FileUploadResponse)
async def upload_file(
    workspace_id: uuid.UUID,
    node_id: str = Form(...),
    file: UploadFile = ...,
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.get_workspace(workspace_id, db)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content type '{file.content_type}'. Allowed: {sorted(_ALLOWED_CONTENT_TYPES)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {_MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    file_record = await files_service.upload_file(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=file.filename or "upload",
        content_type=file.content_type,
        file_bytes=file_bytes,
        db=db,
    )

    return FileUploadResponse(
        file_id=file_record.id,
        node_id=file_record.node_id,
        filename=file_record.filename,
        content_type=file_record.content_type,
    )
