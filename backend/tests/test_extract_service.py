# tests/test_extract_service.py
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import select

from app.models.clerse import File
from app.services.extract import extract_pdf, extract_youtube, extract_article


@pytest.mark.asyncio
async def test_extract_pdf_returns_pages_and_saves_file(db, workspace):
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello PDF world")
    pdf_bytes = doc.tobytes()
    doc.close()

    result = await extract_pdf(
        file_bytes=pdf_bytes,
        filename="test.pdf",
        workspace_id=workspace.id,
        node_id="node-pdf-1",
        db=db,
    )

    assert result["filename"] == "test.pdf"
    assert len(result["pages"]) == 1
    assert "Hello PDF world" in result["pages"][0]["text"]

    file_row = await db.scalar(
        select(File).where(
            File.workspace_id == workspace.id,
            File.node_id == "node-pdf-1",
        )
    )
    assert file_row is not None
    assert file_row.content_type == "application/pdf"
    assert "Hello PDF world" in file_row.content_text
    assert file_row.filename == "test.pdf"


@pytest.mark.asyncio
async def test_extract_youtube_returns_transcript_and_saves_file(db, workspace):
    fake_transcript = [
        {"text": "Hello world", "start": 0.0, "duration": 1.5},
        {"text": "This is a test", "start": 1.5, "duration": 2.0},
    ]

    with patch("app.services.extract.YouTubeTranscriptApi") as mock_api:
        mock_api.get_transcript.return_value = fake_transcript

        result = await extract_youtube(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            workspace_id=workspace.id,
            node_id="node-yt-1",
            db=db,
        )

    assert result["transcript"] == "Hello world This is a test"
    assert result["title"] == "dQw4w9WgXcQ"

    file_row = await db.scalar(
        select(File).where(
            File.workspace_id == workspace.id,
            File.node_id == "node-yt-1",
        )
    )
    assert file_row is not None
    assert file_row.content_type == "text/plain"
    assert "Hello world" in file_row.content_text


@pytest.mark.asyncio
async def test_extract_article_returns_text_and_saves_file(db, workspace):
    with patch("app.services.extract.trafilatura") as mock_traf:
        mock_traf.fetch_url.return_value = "<html><body>Article body</body></html>"
        mock_traf.extract.return_value = "Article body"
        mock_traf.extract_metadata.return_value = MagicMock(title="My Article")

        result = await extract_article(
            url="https://example.com/article",
            workspace_id=workspace.id,
            node_id="node-art-1",
            db=db,
        )

    assert result["text"] == "Article body"
    assert result["title"] == "My Article"

    file_row = await db.scalar(
        select(File).where(
            File.workspace_id == workspace.id,
            File.node_id == "node-art-1",
        )
    )
    assert file_row is not None
    assert file_row.content_text == "Article body"
