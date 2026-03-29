# app/schemas/clerse.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    title: str


class WorkspaceUpdate(BaseModel):
    canvas_state: dict | None = None
    title: str | None = None


class WorkspaceCreatedResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceGetResponse(BaseModel):
    id: uuid.UUID
    title: str
    canvas_state: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceUpdatedResponse(BaseModel):
    id: uuid.UUID
    title: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    workspace_id: uuid.UUID
    node_id: str
    content: str
    model: str = "claude-sonnet-4-6"
    connected_node_ids: list[str] = []


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
