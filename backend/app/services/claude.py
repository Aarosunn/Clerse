# app/services/claude.py
from __future__ import annotations

import json
import uuid
from typing import AsyncGenerator, Any

import anthropic

from app.core.config import settings
from app.models.clerse import Message, Workspace
from app.services.context import assemble_context
from app.services.tool_execution import execute_tool
from app.services.tools import TOOL_DEFINITIONS
from sqlalchemy.ext.asyncio import AsyncSession

anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_chat(
    workspace_id: uuid.UUID,
    node_id: str,
    user_content: str,
    connected_node_ids: list[str],
    model: str,
    db: AsyncSession,
    system_override: str | None = None,
) -> AsyncGenerator[str, None]:
    # 0. Ensure workspace exists (frontend may create UUID client-side before DB record exists)
    existing = await db.get(Workspace, workspace_id)
    if existing is None:
        db.add(Workspace(id=workspace_id, title="New Workspace"))
        await db.commit()

    # 1. Save user message
    user_msg = Message(
        workspace_id=workspace_id,
        node_id=node_id,
        role="user",
        content=user_content,
    )
    db.add(user_msg)
    await db.commit()

    # 2. Assemble context
    system_prompt, messages, context_truncated = await assemble_context(
        workspace_id, node_id, connected_node_ids, db
    )
    if system_override is not None:
        system_prompt = system_override

    # 3. First stream — may include tool calls
    accumulated_text = ""
    tool_calls: list[dict[str, Any]] = []
    assistant_content_blocks: list[dict] = []
    usage = None

    # Track the index in assistant_content_blocks for the current open text block
    _current_text_block_idx: int | None = None

    # When system_override is set (e.g. direct flashcard generation), strip tools
    # so Claude returns plain text instead of calling canvas tools.
    active_tools = [] if system_override is not None else TOOL_DEFINITIONS

    async with anthropic_client.messages.stream(
        model=model,
        max_tokens=settings.ANTHROPIC_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
        tools=active_tools,
    ) as stream:
        async for event in stream:
            if event.type == "content_block_start" and hasattr(event, "content_block"):
                if event.content_block.type == "tool_use":
                    yield sse_event({"type": "tool_start", "name": event.content_block.name})
                    tool_calls.append({
                        "id": event.content_block.id,
                        "name": event.content_block.name,
                        "input": "",
                    })
                    assistant_content_blocks.append({
                        "type": "tool_use",
                        "id": event.content_block.id,
                        "name": event.content_block.name,
                        "input": {},  # filled after parse
                    })
                    _current_text_block_idx = None
                elif event.content_block.type == "text":
                    assistant_content_blocks.append({"type": "text", "text": ""})
                    _current_text_block_idx = len(assistant_content_blocks) - 1

            elif event.type == "content_block_delta":
                if hasattr(event.delta, "text"):
                    accumulated_text += event.delta.text
                    yield sse_event({"type": "token", "text": event.delta.text})
                    if _current_text_block_idx is not None:
                        assistant_content_blocks[_current_text_block_idx]["text"] += event.delta.text
                elif hasattr(event.delta, "partial_json") and tool_calls:
                    tool_calls[-1]["input"] += event.delta.partial_json

        final_msg = await stream.get_final_message()
        usage = final_msg.usage

    # 4. Execute tools OUTSIDE the stream loop
    tool_results: list[dict] = []
    for tc in tool_calls:
        try:
            parsed_input = json.loads(tc["input"]) if tc["input"] else {}
        except json.JSONDecodeError:
            parsed_input = {}
        tc["input"] = parsed_input

        # Patch assistant_content_blocks input
        for block in assistant_content_blocks:
            if block.get("id") == tc["id"]:
                block["input"] = parsed_input

        result = await execute_tool(tc["name"], parsed_input, workspace_id, node_id, db)
        tool_results.append({"tool_call_id": tc["id"], "result": result})
        yield sse_event({"type": "tool_result", "name": tc["name"], **result})

    # 5. Follow-up stream if tools were used
    if tool_calls:
        # Build tool result message for Anthropic
        tool_result_content = [
            {
                "type": "tool_result",
                "tool_use_id": tr["tool_call_id"],
                "content": json.dumps(tr["result"]),
            }
            for tr in tool_results
        ]

        followup_messages = messages + [
            {
                "role": "assistant",
                "content": assistant_content_blocks if assistant_content_blocks else accumulated_text or " ",
            },
            {"role": "user", "content": tool_result_content},
        ]

        async with anthropic_client.messages.stream(
            model=model,
            max_tokens=settings.ANTHROPIC_MAX_TOKENS,
            system=system_prompt,
            messages=followup_messages,
            tools=active_tools,
        ) as stream2:
            async for event in stream2:
                if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                    accumulated_text += event.delta.text
                    yield sse_event({"type": "token", "text": event.delta.text})
            final_msg2 = await stream2.get_final_message()
            usage = final_msg2.usage

    # 6. Save assistant message
    assistant_msg = Message(
        workspace_id=workspace_id,
        node_id=node_id,
        role="assistant",
        content=accumulated_text or None,
    )
    db.add(assistant_msg)
    await db.commit()

    # 7. Done event
    yield sse_event({
        "type": "done",
        "message_id": str(assistant_msg.id),
        "usage": {
            "input_tokens": usage.input_tokens if usage else 0,
            "output_tokens": usage.output_tokens if usage else 0,
        },
        "context_truncated": context_truncated,
    })
