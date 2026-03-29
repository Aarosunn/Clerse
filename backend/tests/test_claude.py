import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.clerse import Message, Workspace
from app.services.claude import stream_chat, sse_event
from sqlalchemy import select


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_text_event(text: str):
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.text = text
    del event.delta.partial_json  # ensure attribute absent
    return event


def _make_tool_start_event(tool_id: str, tool_name: str):
    event = MagicMock()
    event.type = "content_block_start"
    event.content_block = MagicMock()
    event.content_block.type = "tool_use"
    event.content_block.id = tool_id
    event.content_block.name = tool_name
    return event


def _make_partial_json_event(partial: str):
    event = MagicMock()
    event.type = "content_block_delta"
    event.delta = MagicMock()
    event.delta.partial_json = partial
    del event.delta.text  # ensure attribute absent
    return event


def _make_final_message(input_tokens=100, output_tokens=50):
    msg = MagicMock()
    msg.usage = MagicMock()
    msg.usage.input_tokens = input_tokens
    msg.usage.output_tokens = output_tokens
    return msg


def _mock_stream(events: list, final_message):
    """Build a mock async context manager that yields events."""
    stream = MagicMock()
    stream.__aenter__ = AsyncMock(return_value=stream)
    stream.__aexit__ = AsyncMock(return_value=False)
    stream.get_final_message = AsyncMock(return_value=final_message)

    async def _aiter(_self=None):
        for e in events:
            yield e

    stream.__aiter__ = _aiter
    return stream


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stream_chat_text_only(workspace, db):
    """Pure text response — no tools. Saves user+assistant messages, yields tokens+done."""
    events = [_make_text_event("Hello "), _make_text_event("world")]
    final = _make_final_message(100, 10)

    mock_stream = _mock_stream(events, final)

    with patch("app.services.claude.anthropic_client.messages.stream", return_value=mock_stream):
        chunks = []
        async for chunk in stream_chat(
            workspace_id=workspace.id,
            node_id="node-1",
            user_content="Hi",
            connected_node_ids=[],
            model="claude-sonnet-4-6",
            db=db,
        ):
            chunks.append(chunk)

    # Parse SSE lines
    events_data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]

    token_events = [e for e in events_data if e["type"] == "token"]
    done_events = [e for e in events_data if e["type"] == "done"]

    assert len(token_events) == 2
    assert token_events[0]["text"] == "Hello "
    assert token_events[1]["text"] == "world"
    assert len(done_events) == 1
    assert done_events[0]["usage"]["input_tokens"] == 100

    # Verify DB: 1 user message + 1 assistant message
    msgs = list((await db.execute(select(Message).order_by(Message.created_at))).scalars().all())
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[0].content == "Hi"
    assert msgs[1].role == "assistant"
    assert msgs[1].content == "Hello world"


@pytest.mark.asyncio
async def test_stream_chat_yields_tool_start_event(workspace, db):
    """When Claude calls a tool, tool_start SSE is yielded and tool_result follows."""
    tool_id = "toolu_abc"
    events_first = [
        _make_tool_start_event(tool_id, "suggest_branch"),
        _make_partial_json_event('{"title": "CNNs", "reason": "more depth"}'),
    ]
    final_first = _make_final_message(50, 20)

    # Second stream (follow-up after tool) — text response
    events_second = [_make_text_event("I've suggested a branch.")]
    final_second = _make_final_message(80, 10)

    call_count = 0

    def _stream_factory(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_stream(events_first, final_first)
        return _mock_stream(events_second, final_second)

    with patch("app.services.claude.anthropic_client.messages.stream", side_effect=_stream_factory):
        chunks = []
        async for chunk in stream_chat(
            workspace_id=workspace.id,
            node_id="node-1",
            user_content="Suggest a branch",
            connected_node_ids=[],
            model="claude-sonnet-4-6",
            db=db,
        ):
            chunks.append(chunk)

    events_data = [json.loads(c.removeprefix("data: ").strip()) for c in chunks if c.startswith("data: ")]
    types = [e["type"] for e in events_data]

    assert "tool_start" in types
    assert "tool_result" in types
    assert "done" in types

    tool_start = next(e for e in events_data if e["type"] == "tool_start")
    assert tool_start["name"] == "suggest_branch"


@pytest.mark.asyncio
async def test_stream_chat_mixed_text_and_tool(workspace, db):
    """Text delta + tool call in same response — assistant_content_blocks must include both."""
    tool_id = "toolu_xyz"
    events_first = [
        # Text block starts first
        MagicMock(**{"type": "content_block_start", "content_block": MagicMock(**{"type": "text"})}),
        _make_text_event("Let me branch this."),
        # Then tool_use block
        _make_tool_start_event(tool_id, "suggest_branch"),
        _make_partial_json_event('{"title": "Deep dive", "reason": "more detail"}'),
    ]
    final_first = _make_final_message(60, 25)

    captured_followup_messages = []

    events_second = [_make_text_event("Done.")]
    final_second = _make_final_message(90, 8)

    call_count = 0

    def _stream_factory(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            captured_followup_messages.extend(kwargs.get("messages", []))
        if call_count == 1:
            return _mock_stream(events_first, final_first)
        return _mock_stream(events_second, final_second)

    with patch("app.services.claude.anthropic_client.messages.stream", side_effect=_stream_factory):
        async for _ in stream_chat(
            workspace_id=workspace.id,
            node_id="node-1",
            user_content="Branch this",
            connected_node_ids=[],
            model="claude-sonnet-4-6",
            db=db,
        ):
            pass

    # The follow-up stream's messages should end with an assistant turn
    # that has BOTH a text block and a tool_use block
    assert len(captured_followup_messages) >= 2
    assistant_turn = next(
        (m for m in reversed(captured_followup_messages) if m["role"] == "assistant"),
        None,
    )
    assert assistant_turn is not None
    content = assistant_turn["content"]
    assert isinstance(content, list)
    block_types = [b["type"] for b in content]
    assert "text" in block_types
    assert "tool_use" in block_types


@pytest.mark.asyncio
async def test_sse_event_format():
    """sse_event() produces correct SSE format."""
    result = sse_event({"type": "token", "text": "hello"})
    assert result == 'data: {"type": "token", "text": "hello"}\n\n'
