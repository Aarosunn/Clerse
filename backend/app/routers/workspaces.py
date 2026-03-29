# app/routers/workspaces.py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import (
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
