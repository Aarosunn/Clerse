# tests/test_file_upload.py
import uuid
import pytest
import base64
import pytest_asyncio
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


@pytest_asyncio.fixture
async def workspace(db):
    ws = Workspace(title="Upload Test Workspace")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


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
