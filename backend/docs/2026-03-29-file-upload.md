# File Upload Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/workspaces/{workspace_id}/files` for uploading image files as base64 to the `files` table.

**Architecture:** The endpoint accepts multipart form-data with `file` and `node_id` fields, validates content type (images only) and file size (≤10MB), base64-encodes the bytes, and stores the record in the `files` table. No external storage — all base64 in Postgres.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Pydantic, Python `base64` stdlib, existing `File` ORM model in `app/models/clerse.py`

---

### Task 1: Schemas for file upload ✅

**Files:**
- Modified: `app/schemas/clerse.py`
- Created: `tests/test_file_upload.py`

Added `FileUploadResponse` Pydantic schema:

```python
class FileUploadResponse(BaseModel):
    file_id: uuid.UUID
    node_id: str
    filename: str
    content_type: str

    model_config = {"from_attributes": True}
```

---

### Task 2: File upload service function ✅

**Files:**
- Created: `app/services/files.py`

```python
# app/services/files.py
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
```

---

### Task 3: File upload router endpoint ✅

**Files:**
- Created: `app/routers/files.py`
- Modified: `main.py`

Endpoint validates:
- Workspace exists → 404
- `content_type` in `{image/png, image/jpeg, image/gif, image/webp}` → 415
- File size ≤ 10MB → 413

Returns `{file_id, node_id, filename, content_type}` with 201. Response is manually constructed — do NOT use `model_validate(file_record)` since schema field is `file_id` but ORM column is `id`.

```python
return FileUploadResponse(
    file_id=file_record.id,
    node_id=file_record.node_id,
    filename=file_record.filename,
    content_type=file_record.content_type,
)
```

**Known tradeoff:** File bytes are fully read into memory before the size check. A pre-check on `Content-Length` header would avoid buffering large rejected uploads.
