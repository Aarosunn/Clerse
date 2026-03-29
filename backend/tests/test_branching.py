# tests/test_branching.py
import uuid
import pytest
from app.schemas.clerse import BranchCreateRequest, BranchCreateResponse


def test_branch_create_request_schema():
    msg_id_1 = uuid.uuid4()
    msg_id_2 = uuid.uuid4()
    req = BranchCreateRequest(
        source_message_ids=[msg_id_1, msg_id_2],
        title="Deep dive into CNNs",
        child_node_id="node-xyz",
    )
    assert len(req.source_message_ids) == 2
    assert req.title == "Deep dive into CNNs"
    assert req.child_node_id == "node-xyz"


def test_branch_create_response_schema():
    branch_id = uuid.uuid4()
    msg_id = uuid.uuid4()
    resp = BranchCreateResponse(
        branch_id=branch_id,
        parent_node_id="node-abc",
        child_node_id="node-xyz",
        source_message_ids=[msg_id],
    )
    assert resp.branch_id == branch_id
    assert resp.parent_node_id == "node-abc"
    assert resp.child_node_id == "node-xyz"
    assert resp.source_message_ids == [msg_id]
