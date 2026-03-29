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
