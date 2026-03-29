# app/services/tool_execution.py
from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import Branch, File, Message


async def execute_tool(
    name: str,
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Dispatch to the appropriate tool executor. Returns dict with nodes + edges."""
    if name == "create_branches":
        return await _execute_create_branches(input, workspace_id, source_node_id, db)
    if name == "suggest_branch":
        return {"title": input["title"], "reason": input["reason"]}
    if name == "create_markdown":
        return await _execute_create_markdown(input, workspace_id, source_node_id, db)
    if name == "generate_flashcards":
        return await _execute_generate_flashcards(input, workspace_id, source_node_id, db)
    if name == "generate_quiz":
        return await _execute_generate_quiz(input, workspace_id, source_node_id, db)
    if name == "create_pdf_doc":
        return await _execute_create_pdf_doc(input, workspace_id, source_node_id, db)
    raise ValueError(f"Unknown tool: {name}")


async def _execute_create_branches(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    branches_input = input["branches"]
    num = len(branches_input)

    # Fetch source node messages ordered by created_at to map indices → UUIDs
    result = await db.execute(
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.node_id == source_node_id)
        .order_by(Message.created_at)
    )
    node_messages = list(result.scalars().all())
    message_id_map: list[str] = [str(m.id) for m in node_messages]

    nodes = []
    edges = []

    for i, branch in enumerate(branches_input):
        child_node_id = f"node-{uuid.uuid4()}"
        # Spread branch nodes vertically around the source
        y_offset = (i - (num - 1) / 2) * 220
        nodes.append({
            "id": child_node_id,
            "type": "chat",
            "position": {"x": 400, "y": y_offset},
            "data": {"title": branch["title"]},
        })
        edges.append({
            "id": f"edge-{uuid.uuid4()}",
            "source": source_node_id,
            "target": child_node_id,
        })

        # Map relevant_message_indices → message UUIDs
        relevant_indices = branch.get("relevant_message_indices", [])
        source_msg_ids = [
            message_id_map[idx]
            for idx in relevant_indices
            if 0 <= idx < len(message_id_map)
        ]

        db.add(Branch(
            workspace_id=workspace_id,
            parent_node_id=source_node_id,
            child_node_id=child_node_id,
            source_message_ids=source_msg_ids,
        ))

    await db.commit()
    return {"nodes": nodes, "edges": edges}


async def _execute_create_markdown(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.md",
        content_type="text/markdown",
        content_text=input["content"],
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "artifact", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_generate_flashcards(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.json",
        content_type="application/json",
        content_text=json.dumps(input["cards"]),
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "flashcard", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_generate_quiz(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.json",
        content_type="application/json",
        content_text=json.dumps(input["questions"]),
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "quiz", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


async def _execute_create_pdf_doc(
    input: dict[str, Any],
    workspace_id: uuid.UUID,
    source_node_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    node_id = f"node-{uuid.uuid4()}"
    db.add(File(
        workspace_id=workspace_id,
        node_id=node_id,
        filename=f"{input['title']}.tex",
        content_type="application/x-latex",
        content_text=input["content"],
    ))
    await db.commit()
    return {
        "nodes": [_make_node(node_id, "pdf_doc", input["title"])],
        "edges": [_make_edge(source_node_id, node_id)],
    }


def _make_node(node_id: str, node_type: str, title: str) -> dict:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 400, "y": 0},
        "data": {"title": title},
    }


def _make_edge(source: str, target: str) -> dict:
    return {
        "id": f"edge-{uuid.uuid4()}",
        "source": source,
        "target": target,
    }
