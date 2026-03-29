# Workspace CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four Workspace CRUD endpoints (`POST`, `GET`, `PUT`, `DELETE`) under `/api/workspaces` per the contracts in `CLAUDE.md`.

**Architecture:** Pydantic schemas define request/response shapes. A service layer (`app/services/workspaces.py`) owns all DB logic. A thin router (`app/routers/workspaces.py`) handles HTTP concerns only. Tests use an in-memory SQLite DB via `aiosqlite` with `get_db` overridden via FastAPI's `dependency_overrides`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, aiosqlite (test only), pytest-asyncio, httpx

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `pyproject.toml` | Add `aiosqlite` to dev deps |
| Modify | `tests/conftest.py` | Async SQLite engine + `client` fixture with `get_db` override |
| Create | `app/schemas/clerse.py` | Pydantic request/response models for Workspace endpoints |
| Create | `app/services/workspaces.py` | `create_workspace`, `get_workspace`, `update_workspace`, `delete_workspace` |
| Create | `app/routers/workspaces.py` | POST, GET, PUT, DELETE route handlers — thin, delegates to service |
| Modify | `main.py` | Mount `workspaces.router` at `/api` |
| Create | `tests/test_workspaces.py` | Integration tests for all four endpoints |

---

## Task 1: Test Infrastructure

**Files:**
- Modify: `pyproject.toml`
- Modify: `tests/conftest.py`

- [ ] **Step 1: Add `aiosqlite` to dev dependencies**

In `pyproject.toml`, replace:
```toml
[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
]
```
with:
```toml
[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
    "aiosqlite>=0.20.0",
]
```

- [ ] **Step 2: Install the new dep**

Run:
```bash
uv sync
```
Expected: resolves and installs `aiosqlite`.

- [ ] **Step 3: Write the conftest with async DB and client fixtures**

Replace `tests/conftest.py` with:
```python
# tests/conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.models.clerse import Base
from main import app


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

- [ ] **Step 4: Verify existing tests still pass with the new conftest**

Run:
```bash
uv run pytest tests/test_main.py tests/test_models.py -v
```
Expected: all pass. (`test_main.py` doesn't use `client` fixture — no interference.)

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `app/schemas/clerse.py`

- [ ] **Step 1: Write `app/schemas/clerse.py`**

```python
# app/schemas/clerse.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    title: str


class WorkspaceUpdate(BaseModel):
    canvas_state: dict | None = None
    title: str | None = None


class WorkspaceCreatedResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceGetResponse(BaseModel):
    id: uuid.UUID
    title: str
    canvas_state: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceUpdatedResponse(BaseModel):
    id: uuid.UUID
    title: str
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Smoke-check the schemas import cleanly**

Run:
```bash
uv run python -c "from app.schemas.clerse import WorkspaceCreate, WorkspaceUpdate, WorkspaceCreatedResponse, WorkspaceGetResponse, WorkspaceUpdatedResponse; print('OK')"
```
Expected: `OK`

---

## Task 3: POST /api/workspaces

**Files:**
- Create: `app/services/workspaces.py`
- Create: `app/routers/workspaces.py`
- Modify: `main.py`
- Create: `tests/test_workspaces.py` (first test only)

- [ ] **Step 1: Write the failing test**

Create `tests/test_workspaces.py`:
```python
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_create_workspace -v
```
Expected: FAIL — `404 Not Found` (route doesn't exist yet).

- [ ] **Step 3: Write the service**

Create `app/services/workspaces.py`:
```python
# app/services/workspaces.py
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clerse import Workspace


async def create_workspace(title: str, db: AsyncSession) -> Workspace:
    workspace = Workspace(title=title)
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return result.scalar_one_or_none()


async def update_workspace(
    workspace_id: uuid.UUID,
    canvas_state: dict | None,
    title: str | None,
    db: AsyncSession,
) -> Workspace | None:
    workspace = await get_workspace(workspace_id, db)
    if workspace is None:
        return None
    if canvas_state is not None:
        workspace.canvas_state = canvas_state
    if title is not None:
        workspace.title = title
    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession) -> bool:
    workspace = await get_workspace(workspace_id, db)
    if workspace is None:
        return False
    await db.delete(workspace)
    await db.commit()
    return True
```

- [ ] **Step 4: Write the router (POST only for now)**

Create `app/routers/workspaces.py`:
```python
# app/routers/workspaces.py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.clerse import (
    WorkspaceCreate,
    WorkspaceCreatedResponse,
    WorkspaceGetResponse,
    WorkspaceUpdate,
    WorkspaceUpdatedResponse,
)
from app.services import workspaces as workspace_service

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.post("", status_code=201, response_model=WorkspaceCreatedResponse)
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    workspace = await workspace_service.create_workspace(body.title, db)
    return workspace
```

- [ ] **Step 5: Mount the router in `main.py`**

In `main.py`, add the import and `include_router` call:
```python
# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.routers import workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces.router)


@app.get("/")
def root():
    return {"app": "clerse", "status": "running"}
```

- [ ] **Step 6: Run the test — verify it passes**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_create_workspace -v
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/schemas/clerse.py app/services/workspaces.py app/routers/workspaces.py main.py tests/conftest.py tests/test_workspaces.py pyproject.toml
git commit -m "feat: add POST /api/workspaces endpoint with service layer and schemas"
```

---

## Task 4: GET /api/workspaces/{workspace_id}

**Files:**
- Modify: `tests/test_workspaces.py`
- Modify: `app/routers/workspaces.py`

- [ ] **Step 1: Add the failing tests**

Append to `tests/test_workspaces.py`:
```python
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
```

- [ ] **Step 2: Run — verify they fail**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_get_workspace tests/test_workspaces.py::test_get_workspace_not_found -v
```
Expected: FAIL — `404 Not Found` (GET route doesn't exist yet).

- [ ] **Step 3: Add GET route to the router**

In `app/routers/workspaces.py`, append after the POST handler:
```python
@router.get("/{workspace_id}", response_model=WorkspaceGetResponse)
async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    workspace = await workspace_service.get_workspace(workspace_id, db)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace
```

- [ ] **Step 4: Run — verify they pass**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_get_workspace tests/test_workspaces.py::test_get_workspace_not_found -v
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/workspaces.py tests/test_workspaces.py
git commit -m "feat: add GET /api/workspaces/{id} endpoint"
```

---

## Task 5: PUT /api/workspaces/{workspace_id}

**Files:**
- Modify: `tests/test_workspaces.py`
- Modify: `app/routers/workspaces.py`

- [ ] **Step 1: Add the failing tests**

Append to `tests/test_workspaces.py`:
```python
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
```

- [ ] **Step 2: Run — verify they fail**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_update_workspace_title tests/test_workspaces.py::test_update_workspace_canvas_state tests/test_workspaces.py::test_update_workspace_not_found -v
```
Expected: FAIL — `405 Method Not Allowed` (PUT route doesn't exist yet).

- [ ] **Step 3: Add PUT route to the router**

In `app/routers/workspaces.py`, append after the GET handler:
```python
@router.put("/{workspace_id}", response_model=WorkspaceUpdatedResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
):
    workspace = await workspace_service.update_workspace(
        workspace_id, body.canvas_state, body.title, db
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace
```

- [ ] **Step 4: Run — verify they pass**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_update_workspace_title tests/test_workspaces.py::test_update_workspace_canvas_state tests/test_workspaces.py::test_update_workspace_not_found -v
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/workspaces.py tests/test_workspaces.py
git commit -m "feat: add PUT /api/workspaces/{id} endpoint"
```

---

## Task 6: DELETE /api/workspaces/{workspace_id}

**Files:**
- Modify: `tests/test_workspaces.py`
- Modify: `app/routers/workspaces.py`

- [ ] **Step 1: Add the failing tests**

Append to `tests/test_workspaces.py`:
```python
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
```

- [ ] **Step 2: Run — verify they fail**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_delete_workspace tests/test_workspaces.py::test_delete_workspace_not_found -v
```
Expected: FAIL — `405 Method Not Allowed` (DELETE route doesn't exist yet).

- [ ] **Step 3: Add DELETE route to the router**

In `app/routers/workspaces.py`, append after the PUT handler:
```python
@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await workspace_service.delete_workspace(workspace_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workspace not found")
```

- [ ] **Step 4: Run — verify they pass**

Run:
```bash
uv run pytest tests/test_workspaces.py::test_delete_workspace tests/test_workspaces.py::test_delete_workspace_not_found -v
```
Expected: both PASS.

- [ ] **Step 5: Run the full test suite to confirm nothing regressed**

Run:
```bash
uv run pytest -v
```
Expected: all tests pass, including `test_main.py` and `test_models.py`.

- [ ] **Step 6: Commit**

```bash
git add app/routers/workspaces.py tests/test_workspaces.py
git commit -m "feat: add DELETE /api/workspaces/{id} endpoint — workspace CRUD complete"
```
