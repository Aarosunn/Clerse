# tests/test_extract_router.py
import io
import pytest
from unittest.mock import patch

import fitz
from httpx import AsyncClient


def _make_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Router PDF test")
    data = doc.tobytes()
    doc.close()
    return data


@pytest.mark.asyncio
async def test_extract_pdf_endpoint(client: AsyncClient, workspace):
    pdf_bytes = _make_pdf_bytes()

    with patch("app.routers.extract.extract_pdf") as mock_svc:
        mock_svc.return_value = {
            "filename": "test.pdf",
            "pages": [{"page": 1, "text": "Router PDF test"}],
        }

        response = await client.post(
            "/api/extract/pdf",
            data={
                "workspace_id": str(workspace.id),
                "node_id": "node-pdf-1",
            },
            files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "test.pdf"
    assert len(body["pages"]) == 1
    assert body["pages"][0]["text"] == "Router PDF test"

    mock_svc.assert_called_once()
    call_kwargs = mock_svc.call_args.kwargs
    assert call_kwargs["filename"] == "test.pdf"
    assert call_kwargs["node_id"] == "node-pdf-1"


@pytest.mark.asyncio
async def test_extract_youtube_endpoint(client: AsyncClient, workspace):
    with patch("app.routers.extract.extract_youtube") as mock_svc:
        mock_svc.return_value = {
            "transcript": "Hello world",
            "title": "dQw4w9WgXcQ",
        }

        response = await client.post(
            "/api/extract/youtube",
            json={
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "workspace_id": str(workspace.id),
                "node_id": "node-yt-1",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] == "Hello world"
    assert body["title"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_extract_article_endpoint(client: AsyncClient, workspace):
    with patch("app.routers.extract.extract_article") as mock_svc:
        mock_svc.return_value = {
            "text": "Article body text",
            "title": "My Article",
        }

        response = await client.post(
            "/api/extract/article",
            json={
                "url": "https://example.com/article",
                "workspace_id": str(workspace.id),
                "node_id": "node-art-1",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Article body text"
    assert body["title"] == "My Article"


@pytest.mark.asyncio
async def test_extract_pdf_file_too_large(client: AsyncClient, workspace):
    large_bytes = b"x" * (10 * 1024 * 1024 + 1)  # 10 MB + 1 byte
    response = await client.post(
        "/api/extract/pdf",
        data={"workspace_id": str(workspace.id), "node_id": "node-pdf-1"},
        files={"file": ("large.pdf", io.BytesIO(large_bytes), "application/pdf")},
    )
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()
