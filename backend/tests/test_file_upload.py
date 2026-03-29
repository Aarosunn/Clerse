# tests/test_file_upload.py
import uuid
import pytest
import base64
from app.schemas.clerse import FileUploadResponse
from app.models.clerse import File, Workspace
from app.services.files import upload_file


def test_file_upload_response_schema():
    data = {
        "file_id": uuid.uuid4(),
        "node_id": "node-abc",
        "filename": "photo.png",
        "content_type": "image/png",
    }
    response = FileUploadResponse(**data)
    assert str(response.file_id) == str(data["file_id"])
    assert response.node_id == "node-abc"
    assert response.filename == "photo.png"
    assert response.content_type == "image/png"


@pytest.mark.asyncio
async def test_upload_file_stores_base64(db, workspace):
    raw_bytes = b"\x89PNG\r\n\x1a\n"  # PNG magic bytes
    file_record = await upload_file(
        workspace_id=workspace.id,
        node_id="node-img-1",
        filename="test.png",
        content_type="image/png",
        file_bytes=raw_bytes,
        db=db,
    )
    assert file_record.id is not None
    assert file_record.workspace_id == workspace.id
    assert file_record.node_id == "node-img-1"
    assert file_record.filename == "test.png"
    assert file_record.content_type == "image/png"
    assert file_record.file_data == base64.b64encode(raw_bytes).decode("utf-8")
    assert file_record.content_text is None


@pytest.mark.asyncio
async def test_upload_file_persisted_to_db(db, workspace):
    from sqlalchemy import select
    raw_bytes = b"fake image data"
    await upload_file(
        workspace_id=workspace.id,
        node_id="node-img-2",
        filename="photo.jpg",
        content_type="image/jpeg",
        file_bytes=raw_bytes,
        db=db,
    )
    result = await db.execute(
        select(File).where(File.workspace_id == workspace.id)
    )
    records = list(result.scalars().all())
    assert len(records) == 1
    assert records[0].filename == "photo.jpg"


import io
import uuid as uuid_module

MAX_SIZE = 10 * 1024 * 1024  # 10MB


@pytest.mark.asyncio
async def test_upload_endpoint_success(client, workspace):
    file_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    response = await client.post(
        f"/api/workspaces/{workspace.id}/files",
        data={"node_id": "node-abc"},
        files={"file": ("test.png", io.BytesIO(file_bytes), "image/png")},
    )
    assert response.status_code == 201
    data = response.json()
    assert "file_id" in data
    assert data["node_id"] == "node-abc"
    assert data["filename"] == "test.png"
    assert data["content_type"] == "image/png"


@pytest.mark.asyncio
async def test_upload_endpoint_rejects_non_image(client, workspace):
    response = await client.post(
        f"/api/workspaces/{workspace.id}/files",
        data={"node_id": "node-abc"},
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_upload_endpoint_rejects_oversized_file(client, workspace):
    big_bytes = b"\x00" * (MAX_SIZE + 1)
    response = await client.post(
        f"/api/workspaces/{workspace.id}/files",
        data={"node_id": "node-abc"},
        files={"file": ("big.png", io.BytesIO(big_bytes), "image/png")},
    )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_upload_endpoint_workspace_not_found(client):
    response = await client.post(
        f"/api/workspaces/{uuid_module.uuid4()}/files",
        data={"node_id": "node-abc"},
        files={"file": ("test.png", io.BytesIO(b"\x89PNG"), "image/png")},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_endpoint_all_allowed_types(client, workspace):
    for content_type, ext in [
        ("image/jpeg", "photo.jpg"),
        ("image/gif", "anim.gif"),
        ("image/webp", "image.webp"),
    ]:
        response = await client.post(
            f"/api/workspaces/{workspace.id}/files",
            data={"node_id": "node-abc"},
            files={"file": (ext, io.BytesIO(b"fake"), content_type)},
        )
        assert response.status_code == 201, f"Expected 201 for {content_type}, got {response.status_code}"
