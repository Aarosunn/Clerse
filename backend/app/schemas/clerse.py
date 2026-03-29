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


class ExtractYouTubeRequest(BaseModel):
    url: str
    workspace_id: uuid.UUID
    node_id: str


class ExtractArticleRequest(BaseModel):
    url: str
    workspace_id: uuid.UUID
    node_id: str


class PDFPageResponse(BaseModel):
    page: int
    text: str


class ExtractPDFResponse(BaseModel):
    pages: list[PDFPageResponse]
    filename: str


class ExtractYouTubeResponse(BaseModel):
    transcript: str
    title: str


class ExtractArticleResponse(BaseModel):
    text: str
    title: str


class FileUploadResponse(BaseModel):
    file_id: uuid.UUID
    node_id: str
    filename: str
    content_type: str

    model_config = {"from_attributes": True}


class BranchCreateRequest(BaseModel):
    source_message_ids: list[uuid.UUID]
    child_node_id: str


class BranchCreateResponse(BaseModel):
    branch_id: uuid.UUID
    parent_node_id: str
    child_node_id: str
    source_message_ids: list[uuid.UUID]

    model_config = {"from_attributes": True}
