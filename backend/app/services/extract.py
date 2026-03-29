# app/services/extract.py
import base64
import re
import uuid

import fitz  # pymupdf
import trafilatura
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api import YouTubeTranscriptApi

from app.models.clerse import File


async def _upsert_file(
    *,
    workspace_id: uuid.UUID,
    node_id: str,
    filename: str | None,
    content_type: str,
    file_data: str | None,
    content_text: str,
    db: AsyncSession,
) -> File:
    existing = await db.scalar(
        select(File).where(
            File.workspace_id == workspace_id,
            File.node_id == node_id,
        )
    )
    if existing:
        existing.filename = filename
        existing.content_type = content_type
        existing.file_data = file_data
        existing.content_text = content_text
        await db.commit()
        await db.refresh(existing)
        return existing

    file_row = File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=filename,
        content_type=content_type,
        file_data=file_data,
        content_text=content_text,
    )
    db.add(file_row)
    await db.commit()
    await db.refresh(file_row)
    return file_row


async def extract_pdf(
    *,
    file_bytes: bytes,
    filename: str,
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> dict:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    full_text_parts = []

    for i, page in enumerate(doc, start=1):
        text = page.get_text()
        pages.append({"page": i, "text": text})
        full_text_parts.append(f"[Page {i}]\n{text}")

    doc.close()
    content_text = "\n\n".join(full_text_parts)
    file_data_b64 = base64.b64encode(file_bytes).decode()

    await _upsert_file(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=filename,
        content_type="application/pdf",
        file_data=file_data_b64,
        content_text=content_text,
        db=db,
    )

    return {"filename": filename, "pages": pages}


def _parse_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:embed/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return url.rstrip("/").split("/")[-1].split("?")[0]


async def extract_youtube(
    *,
    url: str,
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> dict:
    video_id = _parse_video_id(url)
    fetched = YouTubeTranscriptApi().fetch(video_id)
    transcript = " ".join(snippet.text for snippet in fetched)

    await _upsert_file(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{video_id}.txt",
        content_type="text/plain",
        file_data=None,
        content_text=transcript,
        db=db,
    )

    # TODO: YouTubeTranscriptApi does not provide the video title; returning
    # the video ID as a fallback. Resolve actual title via a separate fetch
    # if needed post-hackathon.
    return {"transcript": transcript, "title": video_id}


async def extract_article(
    *,
    url: str,
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> dict:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {"text": "", "title": url}
    text = trafilatura.extract(downloaded) or ""
    metadata = trafilatura.extract_metadata(downloaded)
    title = metadata.title if metadata and metadata.title else url

    await _upsert_file(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=None,
        content_type="text/plain",
        file_data=None,
        content_text=text,
        db=db,
    )

    return {"text": text, "title": title}
