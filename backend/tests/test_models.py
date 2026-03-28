# tests/test_models.py
import uuid
from app.models.clerse import Base, Branch, File, Message, Workspace


def test_all_tables_registered():
    assert set(Base.metadata.tables.keys()) == {
        "workspaces", "messages", "files", "branches"
    }


def test_workspace_columns():
    cols = {c.name for c in Workspace.__table__.columns}
    assert cols == {"id", "title", "canvas_state", "created_at", "updated_at"}


def test_workspace_primary_key_is_uuid():
    pk_col = Workspace.__table__.c["id"]
    assert pk_col.primary_key is True


def test_message_columns():
    cols = {c.name for c in Message.__table__.columns}
    assert cols == {
        "id", "workspace_id", "node_id", "role",
        "content", "tool_calls_json", "tool_call_id", "tool_name", "created_at",
    }


def test_message_workspace_fk():
    fk = list(Message.__table__.c["workspace_id"].foreign_keys)[0]
    assert fk.column.table.name == "workspaces"


def test_file_columns():
    cols = {c.name for c in File.__table__.columns}
    assert cols == {
        "id", "workspace_id", "node_id", "filename",
        "content_type", "file_data", "content_text", "created_at",
    }


def test_branch_columns():
    cols = {c.name for c in Branch.__table__.columns}
    assert cols == {
        "id", "workspace_id", "parent_node_id",
        "child_node_id", "source_message_ids", "created_at",
    }


def test_workspace_default_id_type():
    from sqlalchemy import inspect as sa_inspect
    mapper = sa_inspect(Workspace)
    id_col = mapper.c["id"]
    assert id_col.primary_key is True
