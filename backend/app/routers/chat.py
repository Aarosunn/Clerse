# app/routers/chat.py
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import ChatRequest
from app.services.claude import stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def post_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    return StreamingResponse(
        stream_chat(
            workspace_id=body.workspace_id,
            node_id=body.node_id,
            user_content=body.content,
            connected_node_ids=body.connected_node_ids,
            model=body.model,
            db=db,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
