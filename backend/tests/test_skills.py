# tests/test_skills.py
import pytest
from app.services.skills import get_skill_prompt, SKILLS


def test_default_skill_returns_prompt():
    prompt = get_skill_prompt("Default")
    assert "helpful AI assistant" in prompt
    assert len(prompt) > 20


def test_tutor_skill():
    prompt = get_skill_prompt("Tutor")
    assert "tutor" in prompt.lower()


def test_socratic_skill():
    prompt = get_skill_prompt("Socratic")
    assert "question" in prompt.lower()


def test_research_assistant_skill():
    prompt = get_skill_prompt("Research Assistant")
    assert "research" in prompt.lower()


def test_brainstorm_skill():
    prompt = get_skill_prompt("Brainstorm")
    assert "brainstorm" in prompt.lower() or "creative" in prompt.lower()


def test_unknown_skill_falls_back_to_default():
    prompt = get_skill_prompt("NonExistentSkill")
    assert prompt == get_skill_prompt("Default")


def test_none_skill_falls_back_to_default():
    prompt = get_skill_prompt(None)
    assert prompt == get_skill_prompt("Default")


def test_all_skills_are_strings():
    for name, prompt in SKILLS.items():
        assert isinstance(name, str)
        assert isinstance(prompt, str)
        assert len(prompt) > 0
