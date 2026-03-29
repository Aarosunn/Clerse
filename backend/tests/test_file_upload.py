# tests/test_file_upload.py
import uuid
import pytest
from app.schemas.clerse import FileUploadResponse


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
