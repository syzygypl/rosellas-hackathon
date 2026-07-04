import logging

from app.services.scamper import find_lens, get_lenses, random_questions

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data / retrieval tools (sync)
# ---------------------------------------------------------------------------


def list_scamper_lenses() -> str:
    """List all seven SCAMPER lenses with their letter, name, and description."""
    try:
        lenses = get_lenses()
        output = f"SCAMPER has {len(lenses)} lenses:\n\n"
        for lens in lenses:
            output += f"• [{lens.id}] {lens.letter} — {lens.name}\n  {lens.description}\n\n"
        return output.strip()
    except Exception as e:
        logger.exception("list_scamper_lenses failed")
        return f"Error listing SCAMPER lenses: {e}"


def get_scamper_lens(lens: str) -> str:
    """Retrieve one SCAMPER lens by letter (S/C/A/M/P/E/R), name, or ID (1-7), with guiding questions and real-world examples."""
    try:
        found = find_lens(lens)
        if not found:
            return (
                f"Unknown SCAMPER lens: {lens!r}. "
                "Use a letter (S, C, A, M, P, E, R), a name (e.g. Substitute), or an ID (1-7)."
            )
        output = f"[{found.id}] {found.letter} — {found.name}\n\n{found.description}\n\n"
        output += "Guiding questions:\n" + "\n".join(f"• {q}" for q in found.questions)
        if found.examples:
            output += "\n\nExamples:\n" + "\n".join(f"• {e}" for e in found.examples)
        return output.strip()
    except Exception as e:
        logger.exception("get_scamper_lens failed")
        return f"Error retrieving SCAMPER lens: {e}"


def get_scamper_checklist() -> str:
    """Return the full SCAMPER ideation checklist: every lens with its guiding questions, ready to apply to a problem."""
    try:
        output = (
            "SCAMPER ideation checklist — walk the problem through each lens and "
            "generate at least one concrete idea per promising lens:\n\n"
        )
        for lens in get_lenses():
            output += f"[{lens.id}] {lens.letter} — {lens.name}: {lens.description}\n"
            output += "".join(f"  • {q}\n" for q in lens.questions) + "\n"
        return output.strip()
    except Exception as e:
        logger.exception("get_scamper_checklist failed")
        return f"Error building SCAMPER checklist: {e}"


def get_random_scamper_questions(limit: int = 5) -> str:
    """Return a random selection of SCAMPER guiding questions across lenses, useful as a creative jolt."""
    try:
        picks = random_questions(limit)
        if not picks:
            return "No questions found."
        output = f"{len(picks)} random SCAMPER question(s):\n\n"
        for lens, question in picks:
            output += f"• ({lens.letter} — {lens.name}) {question}\n"
        return output.strip()
    except Exception as e:
        logger.exception("get_random_scamper_questions failed")
        return f"Error retrieving random SCAMPER questions: {e}"
