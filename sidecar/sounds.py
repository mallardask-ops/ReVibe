"""Alert sounds from the freedesktop sound themes installed on this computer.

VibeDeck ships no audio: it plays the system's own themes (Plasma's Ocean,
the freedesktop default) for a finished run, a failed run and a request for
the user's attention. Only themes that are installed are offered.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

# event -> sound names to try in order, per theme (the XDG sound naming spec)
THEMES: dict[str, dict] = {
    "ocean": {
        "name": "Ocean",
        "description": "Soft, warm tones from KDE Plasma.",
        "events": {
            "done": ["completion-success", "outcome-success"],
            "failed": ["completion-fail", "outcome-failure", "dialog-error"],
            "attention": ["dialog-question", "message-attention"],
        },
    },
    "freedesktop": {
        "name": "Classic",
        "description": "The freedesktop default theme.",
        "events": {
            "done": ["complete"],
            "failed": ["dialog-error"],
            "attention": ["window-question", "dialog-information"],
        },
    },
}
EXTENSIONS = (".oga", ".ogg", ".wav")
MEDIA = {".oga": "audio/ogg", ".ogg": "audio/ogg", ".wav": "audio/wav"}


def _sound_dirs() -> list[Path]:
    home = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share")
    dirs = os.environ.get("XDG_DATA_DIRS") or "/usr/local/share:/usr/share"
    return [home / "sounds", *(Path(d) / "sounds" for d in dirs.split(":") if d)]


def find(theme: str, event: str) -> Path | None:
    names = THEMES.get(theme, {}).get("events", {}).get(event)
    if not names:
        return None
    for base in _sound_dirs():
        for name in names:
            for ext in EXTENSIONS:
                path = base / theme / "stereo" / f"{name}{ext}"
                if path.is_file():
                    return path
    return None


@router.get("/api/sounds")
async def list_sounds() -> dict:
    themes = []
    for theme_id, theme in THEMES.items():
        events = [event for event in theme["events"] if find(theme_id, event)]
        if events:
            themes.append({"id": theme_id, "name": theme["name"],
                           "description": theme["description"], "events": events})
    return {"themes": themes}


@router.get("/api/sounds/{theme}/{event}")
async def sound_file(theme: str, event: str) -> FileResponse:
    path = find(theme, event)
    if path is None:
        raise HTTPException(404, "sound not installed")
    return FileResponse(path, media_type=MEDIA[path.suffix],
                        headers={"Cache-Control": "max-age=86400"})
