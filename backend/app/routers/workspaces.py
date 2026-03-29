# app/routers/workspaces.py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import (
    MessageResponse,
    WorkspaceCreate,
    WorkspaceCreatedResponse,
    WorkspaceGetResponse,
    WorkspaceUpdate,
    WorkspaceUpdatedResponse,
)
from app.services import workspaces as workspace_service

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.post("", status_code=201, response_model=WorkspaceCreatedResponse)
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    workspace = await workspace_service.create_workspace(body.title, db)
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceGetResponse)
async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    workspace = await workspace_service.get_workspace(workspace_id, db)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceUpdatedResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.update_workspace(
        workspace_id, body.canvas_state, body.title, db
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await workspace_service.delete_workspace(workspace_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workspace not found")


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
