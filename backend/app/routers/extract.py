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
