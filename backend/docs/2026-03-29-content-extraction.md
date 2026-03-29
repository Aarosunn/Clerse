# Content Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three extraction endpoints (`/api/extract/pdf`, `/api/extract/youtube`, `/api/extract/article`) that pull text from external sources, save the result to the `files` table, and return structured text to the frontend.

**Architecture:** Service layer holds all extraction logic (pymupdf / youtube-transcript-api / trafilatura); routers are thin HTTP adapters. Each endpoint accepts `workspace_id` + `node_id` so the file record is immediately available for context assembly.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, pymupdf, youtube-transcript-api, trafilatura, pytest-asyncio + httpx (tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `app/schemas/clerse.py` | Add `ExtractYouTubeRequest`, `ExtractArticleRequest`, response schemas |
| Create | `app/services/extract.py` | PDF, YouTube, Article extraction + DB save |
| Create | `app/routers/extract.py` | Three HTTP POST endpoints |
| Modify | `main.py` | Mount extract router |
| Create | `tests/test_extract_service.py` | Unit tests for `services/extract.py` |
| Create | `tests/test_extract_router.py` | Integration tests for `/api/extract/*` endpoints |

---

## Task 1: Add Extraction Schemas

**Files:**
- Modify: `app/schemas/clerse.py`

- [ ] **Step 1: Add schemas**

Open `app/schemas/clerse.py` and append the following after the existing `MessageResponse` class:

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add app/schemas/clerse.py
git commit -m "feat: add extraction request/response schemas"
```

---

## Task 2: Implement `services/extract.py`

**Files:**
- Create: `app/services/extract.py`

This service handles all three extraction flows. Each function:
1. Does the extraction (pymupdf / youtube-transcript-api / trafilatura)
2. Upserts a `File` record in the DB (insert if no existing record for `workspace_id` + `node_id`, otherwise update)
3. Returns the structured data

- [ ] **Step 1: Write failing tests for `extract_pdf`**

Create `tests/test_extract_service.py`:

```python
# tests/test_extract_service.py
import io
import uuid
import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock
from sqlalchemy import select

from app.models.clerse import File
from app.services.extract import extract_pdf, extract_youtube, extract_article


@pytest.mark.asyncio
async def test_extract_pdf_returns_pages_and_saves_file(db, workspace):
    # Build a minimal in-memory PDF bytes via pymupdf
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

    # Verify File record was saved
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/asunaron/hackathons/Clerse/backend
python -m pytest tests/test_extract_service.py::test_extract_pdf_returns_pages_and_saves_file -v
```

Expected: `ImportError: cannot import name 'extract_pdf' from 'app.services.extract'` (file doesn't exist yet)

- [ ] **Step 3: Implement `extract_pdf`**

Create `app/services/extract.py`:

```python
# app/services/extract.py
import base64
import uuid

import fitz  # pymupdf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    """Insert or update the File row for this workspace_id + node_id."""
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
    """Extract text from PDF bytes page-by-page. Save to DB. Return pages list."""
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/test_extract_service.py::test_extract_pdf_returns_pages_and_saves_file -v
```

Expected: PASS

- [ ] **Step 5: Write failing test for `extract_youtube`**

Append to `tests/test_extract_service.py`:

```python
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
```

- [ ] **Step 6: Run test to verify it fails**

```bash
python -m pytest tests/test_extract_service.py::test_extract_youtube_returns_transcript_and_saves_file -v
```

Expected: `ImportError: cannot import name 'extract_youtube'`

- [ ] **Step 7: Implement `extract_youtube`**

Append to `app/services/extract.py`:

```python
from youtube_transcript_api import YouTubeTranscriptApi


def _parse_video_id(url: str) -> str:
    """Extract video ID from a YouTube URL."""
    import re
    patterns = [
        r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:embed/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Fall back to last path segment
    return url.rstrip("/").split("/")[-1].split("?")[0]


async def extract_youtube(
    *,
    url: str,
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> dict:
    """Fetch YouTube transcript. Save to DB. Return transcript + title."""
    video_id = _parse_video_id(url)
    transcript_entries = YouTubeTranscriptApi.get_transcript(video_id)
    transcript = " ".join(entry["text"] for entry in transcript_entries)

    await _upsert_file(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{video_id}.txt",
        content_type="text/plain",
        file_data=None,
        content_text=transcript,
        db=db,
    )

    return {"transcript": transcript, "title": video_id}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
python -m pytest tests/test_extract_service.py::test_extract_youtube_returns_transcript_and_saves_file -v
```

Expected: PASS

- [ ] **Step 9: Write failing test for `extract_article`**

Append to `tests/test_extract_service.py`:

```python
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
```

- [ ] **Step 10: Run test to verify it fails**

```bash
python -m pytest tests/test_extract_service.py::test_extract_article_returns_text_and_saves_file -v
```

Expected: `ImportError: cannot import name 'extract_article'`

- [ ] **Step 11: Implement `extract_article`**

Append to `app/services/extract.py`:

```python
import trafilatura


async def extract_article(
    *,
    url: str,
    workspace_id: uuid.UUID,
    node_id: str,
    db: AsyncSession,
) -> dict:
    """Fetch and extract article text. Save to DB. Return text + title."""
    downloaded = trafilatura.fetch_url(url)
    text = trafilatura.extract(downloaded) or ""
    metadata = trafilatura.extract_metadata(downloaded)
    title = (metadata.title if metadata and metadata.title else url)

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
```

- [ ] **Step 12: Run all service tests**

```bash
python -m pytest tests/test_extract_service.py -v
```

Expected: 3 tests PASS

- [ ] **Step 13: Commit**

```bash
git add app/services/extract.py tests/test_extract_service.py
git commit -m "feat: add extract_pdf, extract_youtube, extract_article services"
```

---

## Task 3: Implement `routers/extract.py`

**Files:**
- Create: `app/routers/extract.py`

- [ ] **Step 1: Write failing router tests**

Create `tests/test_extract_router.py`:

```python
# tests/test_extract_router.py
import io
import uuid
import pytest
from unittest.mock import patch, AsyncMock

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_extract_router.py -v
```

Expected: `ImportError` or 404 — router not mounted yet

- [ ] **Step 3: Implement the router**

Create `app/routers/extract.py`:

```python
# app/routers/extract.py
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import (
    ExtractArticleRequest,
    ExtractArticleResponse,
    ExtractPDFResponse,
    ExtractYouTubeRequest,
    ExtractYouTubeResponse,
)
from app.services.extract import extract_article, extract_pdf, extract_youtube

router = APIRouter(prefix="/api/extract", tags=["extract"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/pdf", response_model=ExtractPDFResponse)
async def post_extract_pdf(
    workspace_id: uuid.UUID = Form(...),
    node_id: str = Form(...),
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
) -> ExtractPDFResponse:
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    result = await extract_pdf(
        file_bytes=file_bytes,
        filename=file.filename or "upload.pdf",
        workspace_id=workspace_id,
        node_id=node_id,
        db=db,
    )
    return ExtractPDFResponse(**result)


@router.post("/youtube", response_model=ExtractYouTubeResponse)
async def post_extract_youtube(
    body: ExtractYouTubeRequest,
    db: AsyncSession = Depends(get_db),
) -> ExtractYouTubeResponse:
    result = await extract_youtube(
        url=body.url,
        workspace_id=body.workspace_id,
        node_id=body.node_id,
        db=db,
    )
    return ExtractYouTubeResponse(**result)


@router.post("/article", response_model=ExtractArticleResponse)
async def post_extract_article(
    body: ExtractArticleRequest,
    db: AsyncSession = Depends(get_db),
) -> ExtractArticleResponse:
    result = await extract_article(
        url=body.url,
        workspace_id=body.workspace_id,
        node_id=body.node_id,
        db=db,
    )
    return ExtractArticleResponse(**result)
```

- [ ] **Step 4: Mount router in `main.py`**

In `main.py`, add the import and mount after the existing routers:

```python
# Add to imports at top:
from app.routers import workspaces, chat, extract

# Add after app.include_router(chat.router):
app.include_router(extract.router)
```

- [ ] **Step 5: Run router tests**

```bash
python -m pytest tests/test_extract_router.py -v
```

Expected: 3 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
python -m pytest -v
```

Expected: All tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add app/routers/extract.py tests/test_extract_router.py main.py
git commit -m "feat: add /api/extract/pdf, /youtube, /article endpoints"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement | Task |
|-------------|------|
| `POST /api/extract/pdf` — multipart, returns `{pages, filename}` | Task 3 |
| `POST /api/extract/youtube` — JSON `{url, workspace_id, node_id}`, returns `{transcript, title}` | Task 3 |
| `POST /api/extract/article` — JSON `{url, workspace_id, node_id}`, returns `{text, title}` | Task 3 |
| Save to `files` table with `content_text` for context assembly | Task 2 |
| `workspace_id` + `node_id` in every request | Tasks 2–3 |
| Max file size 10 MB | Task 3 |
| Service layer — no logic in routers | Task 2 / 3 |
| pymupdf / youtube-transcript-api / trafilatura | Task 2 |

All requirements covered. No gaps found.

### Placeholder Scan

No TBDs, TODOs, or vague steps. All test code and implementation code is complete and explicit.

### Type Consistency

- `extract_pdf` returns `dict` with `filename: str`, `pages: list[dict]` — matches `ExtractPDFResponse`
- `extract_youtube` returns `dict` with `transcript: str`, `title: str` — matches `ExtractYouTubeResponse`
- `extract_article` returns `dict` with `text: str`, `title: str` — matches `ExtractArticleResponse`
- All service functions accept keyword-only args (`*,`) — call sites in routers use keyword args consistently
