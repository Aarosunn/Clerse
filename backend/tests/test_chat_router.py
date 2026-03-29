import json
from unittest.mock import patch

import pytest
from httpx import AsyncClient


def _mock_stream_chat(*args, **kwargs):
    """Async generator that yields two SSE events."""
    async def _gen():
        yield 'data: {"type": "token", "text": "hi"}\n\n'
        yield 'data: {"type": "done", "message_id": "abc", "usage": {"input_tokens": 1, "output_tokens": 1}, "context_truncated": false}\n\n'
    return _gen()


@pytest.mark.asyncio
async def test_chat_endpoint_streams_sse(client: AsyncClient, workspace):
    with patch("app.routers.chat.stream_chat", side_effect=_mock_stream_chat):
        response = await client.post(
            "/api/chat",
            json={
                "workspace_id": str(workspace.id),
                "node_id": "node-1",
                "content": "Hello",
                "model": "claude-sonnet-4-6",
                "connected_node_ids": [],
            },
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [l for l in response.text.splitlines() if l.startswith("data: ")]
    assert len(lines) == 2
    token = json.loads(lines[0].removeprefix("data: "))
    assert token["type"] == "token"
    assert token["text"] == "hi"
