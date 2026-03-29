# tests/test_workspaces.py
import uuid

import pytest


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
