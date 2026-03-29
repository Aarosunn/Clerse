"""Tool definitions for Claude canvas operations."""

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "create_branches",
        "description": "Create 2-4 parallel conversation branches exploring different angles of the current topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "branches": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "rationale": {"type": "string"},
                            "relevant_message_indices": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "description": "0-based indices of messages most relevant to this branch",
                            },
                        },
                        "required": ["title"],
                    },
                }
            },
            "required": ["branches"],
        },
    },
    {
        "name": "suggest_branch",
        "description": "Suggest a branch topic without creating it. User must confirm in the UI.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["title", "reason"],
        },
    },
    {
        "name": "create_markdown",
        "description": (
            "Save content (summary, notes, code, explanation) as a persistent artifact node "
            "on the canvas. Use Markdown + KaTeX for formatting."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {
                    "type": "string",
                    "description": "Markdown + KaTeX content",
                },
            },
            "required": ["title", "content"],
        },
    },
    {
        "name": "generate_flashcards",
        "description": "Generate flashcards from the conversation context as a flashcard node.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "front": {"type": "string"},
                            "back": {"type": "string"},
                        },
                        "required": ["front", "back"],
                    },
                },
            },
            "required": ["title", "cards"],
        },
    },
    {
        "name": "generate_quiz",
        "description": "Generate quiz questions from the conversation context as a quiz node.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 4,
                                "maxItems": 4,
                            },
                            "correct_answer": {"type": "string"},
                            "explanation": {"type": "string"},
                        },
                        "required": ["question", "options", "correct_answer", "explanation"],
                    },
                },
            },
            "required": ["title", "questions"],
        },
    },
    {
        "name": "create_pdf_doc",
        "description": "Generate a formatted document as a PDF doc node. Use LaTeX for the content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {
                    "type": "string",
                    "description": "LaTeX document content",
                },
            },
            "required": ["title", "content"],
        },
    },
]
