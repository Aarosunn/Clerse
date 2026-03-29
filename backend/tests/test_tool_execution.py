import json
import uuid
import pytest

from app.models.clerse import Branch, File, Message
from app.services.tool_execution import execute_tool
from sqlalchemy import select


@pytest.mark.asyncio
async def test_execute_suggest_branch(workspace, db):
    result = await execute_tool(
        "suggest_branch",
        {"title": "CNNs", "reason": "dive deeper"},
        workspace.id,
        "node-1",
        db,
    )
    assert result["title"] == "CNNs"
    assert result["reason"] == "dive deeper"
    assert result["nodes"] == []
    assert result["edges"] == []
    # No DB writes
    branches = list((await db.execute(select(Branch))).scalars().all())
    assert len(branches) == 0


@pytest.mark.asyncio
async def test_execute_create_branches_saves_branch_records(workspace, db):
    # Seed 3 messages for the source node
    for i, role in enumerate(["user", "assistant", "user"]):
        msg = Message(
            workspace_id=workspace.id,
            node_id="node-1",
            role=role,
            content=f"msg {i}",
        )
        db.add(msg)
    await db.commit()

    result = await execute_tool(
        "create_branches",
        {
            "branches": [
                {"title": "Branch A", "relevant_message_indices": [0, 1]},
                {"title": "Branch B", "relevant_message_indices": [2]},
            ]
        },
        workspace.id,
        "node-1",
        db,
    )

    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 2
    assert result["nodes"][0]["type"] == "chat"
    assert result["nodes"][0]["data"]["title"] == "Branch A"

    branches = list((await db.execute(select(Branch))).scalars().all())
    assert len(branches) == 2
    assert branches[0].parent_node_id == "node-1"
    assert len(branches[0].source_message_ids) == 2


@pytest.mark.asyncio
async def test_execute_create_markdown(workspace, db):
    result = await execute_tool(
        "create_markdown",
        {"title": "My Notes", "content": "# Hello\n\nWorld"},
        workspace.id,
        "node-1",
        db,
    )

    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["type"] == "artifact"
    assert len(result["edges"]) == 1

    files = list((await db.execute(select(File))).scalars().all())
    assert len(files) == 1
    assert files[0].content_text == "# Hello\n\nWorld"
    assert files[0].content_type == "text/markdown"


@pytest.mark.asyncio
async def test_execute_generate_flashcards(workspace, db):
    cards = [{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]
    result = await execute_tool(
        "generate_flashcards",
        {"title": "My Flashcards", "cards": cards},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "flashcard"
    files = list((await db.execute(select(File))).scalars().all())
    assert json.loads(files[0].content_text) == cards


@pytest.mark.asyncio
async def test_execute_generate_quiz(workspace, db):
    questions = [
        {
            "question": "What is 2+2?",
            "options": ["1", "2", "3", "4"],
            "correct_answer": "4",
            "explanation": "Basic arithmetic",
        }
    ]
    result = await execute_tool(
        "generate_quiz",
        {"title": "My Quiz", "questions": questions},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "quiz"
    files = list((await db.execute(select(File))).scalars().all())
    assert json.loads(files[0].content_text) == questions


@pytest.mark.asyncio
async def test_execute_create_pdf_doc(workspace, db):
    result = await execute_tool(
        "create_pdf_doc",
        {"title": "My Doc", "content": r"\section{Intro} Hello"},
        workspace.id,
        "node-1",
        db,
    )

    assert result["nodes"][0]["type"] == "pdf_doc"
    files = list((await db.execute(select(File))).scalars().all())
    assert r"\section{Intro} Hello" in files[0].content_text


@pytest.mark.asyncio
async def test_execute_tool_unknown_raises(workspace, db):
    with pytest.raises(ValueError, match="Unknown tool"):
        await execute_tool("nonexistent", {}, workspace.id, "node-1", db)
