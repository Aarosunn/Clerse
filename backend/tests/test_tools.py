"""Tests for tool definitions."""
import pytest
from app.services.tools import TOOL_DEFINITIONS


def test_tool_definitions_is_list():
    assert isinstance(TOOL_DEFINITIONS, list)
    assert len(TOOL_DEFINITIONS) == 6


def test_each_tool_has_required_keys():
    for tool in TOOL_DEFINITIONS:
        assert "name" in tool
        assert "description" in tool
        assert "input_schema" in tool
        assert tool["input_schema"]["type"] == "object"
        assert "properties" in tool["input_schema"]
        assert "required" in tool["input_schema"]


def test_tool_names():
    names = [t["name"] for t in TOOL_DEFINITIONS]
    assert "create_branches" in names
    assert "suggest_branch" in names
    assert "create_markdown" in names
    assert "generate_flashcards" in names
    assert "generate_quiz" in names
    assert "create_pdf_doc" in names


def test_create_branches_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "create_branches")
    schema = tool["input_schema"]
    assert "branches" in schema["properties"]
    branches_prop = schema["properties"]["branches"]
    assert branches_prop["type"] == "array"
    assert branches_prop["minItems"] == 2
    assert branches_prop["maxItems"] == 4
    item_props = branches_prop["items"]["properties"]
    assert "title" in item_props
    assert "rationale" in item_props
    assert "relevant_message_indices" in item_props


def test_generate_flashcards_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "generate_flashcards")
    schema = tool["input_schema"]
    assert "title" in schema["properties"]
    assert "cards" in schema["properties"]
    card_props = schema["properties"]["cards"]["items"]["properties"]
    assert "front" in card_props
    assert "back" in card_props


def test_generate_quiz_schema():
    tool = next(t for t in TOOL_DEFINITIONS if t["name"] == "generate_quiz")
    schema = tool["input_schema"]
    assert "questions" in schema["properties"]
    q_props = schema["properties"]["questions"]["items"]["properties"]
    assert "question" in q_props
    assert "options" in q_props
    assert "correct_answer" in q_props
    assert "explanation" in q_props
    assert q_props["options"]["minItems"] == 4
    assert q_props["options"]["maxItems"] == 4
