# app/services/context.py
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import File, Message, Workspace
from app.services.skills import get_skill_prompt

# Node types whose file content goes into the system prompt as reference text
_SYSTEM_PROMPT_NODE_TYPES = {"text", "article", "youtube"}

# Node types whose file data is injected as a block in the first user message
_BLOCK_NODE_TYPES = {"image", "pdf"}


async def get_node_messages(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> list[Message]:
    """Return all messages for a node, ordered oldest first."""
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == node_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def get_node_file(
    workspace_id: uuid.UUID, node_id: str, db: AsyncSession
) -> File | None:
    """Return the file record for a node, or None."""
    result = await db.execute(
        select(File)
        .where(File.workspace_id == workspace_id, File.node_id == node_id)
        .limit(1)
    )
    return result.scalar_one_or_none()


def find_node_in_canvas(canvas_state: dict | None, node_id: str) -> dict | None:
    """Find a node dict in canvas_state["nodes"] by id. Returns None if not found."""
    if not canvas_state:
        return None
    for node in canvas_state.get("nodes", []):
        if node.get("id") == node_id:
            return node
    return None


def build_file_block(file: File) -> dict:
    """Build an Anthropic content block for an image or PDF file."""
    if file.content_type and file.content_type.startswith("image/"):
        media_type = file.content_type  # e.g. "image/png"
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": file.file_data or "",
            },
        }
    # PDF — treated as a document block
    return {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": file.file_data or "",
        },
    }


async def assemble_context(
    workspace_id: uuid.UUID,
    node_id: str,
    connected_node_ids: list[str],
    db: AsyncSession,
) -> tuple[str, list[dict], bool]:
    """
    Assemble the system prompt and Anthropic messages list for a Claude call.

    Returns:
        (system_prompt, anthropic_messages, context_truncated)
    """
    # 1. Resolve skill from canvas_state
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise ValueError(f"Workspace {workspace_id} not found")
    canvas = workspace.canvas_state
    node_data = find_node_in_canvas(canvas, node_id)
    skill = node_data.get("data", {}).get("skill") if node_data else None
    system = get_skill_prompt(skill)

    # 2. Gather connected node contributions
    prepend_blocks: list[dict] = []      # image/pdf blocks for first user message
    artifact_refs: list[str] = []        # text snippets for system prompt
    linked_messages: list[Message] = []  # chat history from linked chat nodes

    for linked_id in connected_node_ids:
        linked_node = find_node_in_canvas(canvas, linked_id)
        if not linked_node:
            continue
        node_type = linked_node.get("type", "")

        if node_type == "chat":
            msgs = await get_node_messages(workspace_id, linked_id, db)
            linked_messages.extend(msgs)

        elif node_type in _BLOCK_NODE_TYPES:
            file = await get_node_file(workspace_id, linked_id, db)
            if file:
                prepend_blocks.append(build_file_block(file))

        elif node_type in _SYSTEM_PROMPT_NODE_TYPES:
            file = await get_node_file(workspace_id, linked_id, db)
            if file and file.content_text:
                title = linked_node.get("data", {}).get("title", "Context")
                artifact_refs.append(f"## {title}\n{file.content_text}")

    # 3. Append reference material to system prompt
    if artifact_refs:
        system += "\n\n---\nReference material:\n" + "\n\n".join(artifact_refs)

    # 4. Fetch own messages
    own_messages = await get_node_messages(workspace_id, node_id, db)

    # 5. Truncate linked messages if total is excessive
    total = len(linked_messages) + len(own_messages)
    context_truncated = total > 150
    if context_truncated:
        linked_messages = linked_messages[-10:]

    # 6. Build sorted Anthropic messages list
    all_messages = sorted(linked_messages + own_messages, key=lambda m: m.created_at)
    messages: list[dict[str, Any]] = []
    for msg in all_messages:
        messages.append({"role": msg.role, "content": msg.content or ""})

    # 7. Prepend file blocks into first user message
    if prepend_blocks and messages:
        first_user_idx = next(
            (i for i, m in enumerate(messages) if m["role"] == "user"), None
        )
        if first_user_idx is not None:
            m = messages[first_user_idx]
            messages[first_user_idx] = {
                "role": "user",
                "content": prepend_blocks + [{"type": "text", "text": m["content"]}],
            }
        else:
            # No user message to attach file blocks to — prepend a synthetic user turn
            messages.insert(0, {
                "role": "user",
                "content": prepend_blocks,
            })

    return system, messages, context_truncated
