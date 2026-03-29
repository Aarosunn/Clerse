# tests/test_workspaces.py
import uuid
from datetime import datetime, timezone, timedelta

import pytest

from app.models.clerse import Message


@pytest.mark.asyncio
async def test_create_workspace(client):
    response = await client.post("/api/workspaces", json={"title": "My Workspace"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "My Workspace"
    assert "id" in data
    assert "created_at" in data
    assert "canvas_state" not in data


@pytest.mark.asyncio
async def test_get_workspace(client):
    create_resp = await client.post("/api/workspaces", json={"title": "Test"})
    workspace_id = create_resp.json()["id"]

    response = await client.get(f"/api/workspaces/{workspace_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == workspace_id
    assert data["title"] == "Test"
    assert "canvas_state" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_workspace_not_found(client):
    response = await client.get(f"/api/workspaces/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_workspace_title(client):
    create_resp = await client.post("/api/workspaces", json={"title": "Old Title"})
    workspace_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/workspaces/{workspace_id}", json={"title": "New Title"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == workspace_id
    assert data["title"] == "New Title"
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_update_workspace_canvas_state(client):
    create_resp = await client.post("/api/workspaces", json={"title": "Canvas Test"})
    workspace_id = create_resp.json()["id"]

    canvas_state = {
        "nodes": [{"id": "n1", "type": "chat", "position": {"x": 0, "y": 0}, "data": {}}],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }
    response = await client.put(
        f"/api/workspaces/{workspace_id}", json={"canvas_state": canvas_state}
    )
    assert response.status_code == 200

    get_resp = await client.get(f"/api/workspaces/{workspace_id}")
    assert get_resp.json()["canvas_state"] == canvas_state


@pytest.mark.asyncio
async def test_update_workspace_not_found(client):
    response = await client.put(
        f"/api/workspaces/{uuid.uuid4()}", json={"title": "X"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_workspace(client):
    create_resp = await client.post("/api/workspaces", json={"title": "To Delete"})
    workspace_id = create_resp.json()["id"]

    response = await client.delete(f"/api/workspaces/{workspace_id}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/workspaces/{workspace_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_workspace_not_found(client):
    response = await client.delete(f"/api/workspaces/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_messages_empty(client, workspace):
    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/node-abc/messages"
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_messages_ordered_by_created_at(client, workspace, db):
    node_id = "node-abc"
    msg1 = Message(
        workspace_id=workspace.id, node_id=node_id,
        role="user", content="Hello",
        created_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    )
    db.add(msg1)
    await db.commit()
    await db.refresh(msg1)

    msg2 = Message(
        workspace_id=workspace.id, node_id=node_id,
        role="assistant", content="Hi there",
        created_at=datetime(2024, 1, 1, 12, 0, 1, tzinfo=timezone.utc)
    )
    db.add(msg2)
    await db.commit()
    await db.refresh(msg2)

    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/{node_id}/messages"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "Hello"
    assert data[1]["role"] == "assistant"
    assert data[1]["content"] == "Hi there"
    assert "id" in data[0]
    assert "created_at" in data[0]


@pytest.mark.asyncio
async def test_get_messages_only_for_correct_node(client, workspace, db):
    node_a = "node-aaa"
    node_b = "node-bbb"
    db.add(Message(workspace_id=workspace.id, node_id=node_a, role="user", content="A"))
    db.add(Message(workspace_id=workspace.id, node_id=node_b, role="user", content="B"))
    await db.commit()

    response = await client.get(
        f"/api/workspaces/{workspace.id}/nodes/{node_a}/messages"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "A"


@pytest.mark.asyncio
async def test_get_messages_workspace_not_found(client):
    response = await client.get(
        f"/api/workspaces/{uuid.uuid4()}/nodes/node-abc/messages"
    )
    assert response.status_code == 404
