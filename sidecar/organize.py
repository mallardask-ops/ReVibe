"""Organising sessions: pin one to the top of the sidebar, or move it to
another checkout of its repository (Vibe's ``session/relocate``), such as
a project and its worktrees. Vibe keeps a session in its repository."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StrictBool
from session_rpc import session_call

router = APIRouter()
_store: Any = None
_persist: Optional[Callable[[str, dict], None]] = None
_public: Optional[Callable[[dict], dict]] = None


def configure(store: Any, persist: Callable[[str, dict], None], public: Callable[[dict], dict]) -> None:
    global _store, _persist, _public
    _store, _persist, _public = store, persist, public


def _row(sid: str) -> dict:
    row = _store.get_session(sid)
    if row is None:
        raise HTTPException(404, "session not found")
    return row


class PinReq(BaseModel):
    pinned: StrictBool


class MoveReq(BaseModel):
    cwd: str


@router.post("/api/sessions/{sid}/pin")
async def pin(sid: str, r: PinReq) -> dict:
    row = _row(sid)
    # pinning is ReVibe's own shelf; it does not change the activity order
    _store.upsert_session(sid, pinned_at=time.time() if r.pinned else None, updated_at=row.get("updated_at"))
    return _public(_store.get_session(sid))


@router.post("/api/sessions/{sid}/move")
async def move(sid: str, r: MoveReq) -> Any:
    row = _row(sid)
    target = Path(r.cwd).expanduser()
    if not target.is_absolute() or not target.is_dir():
        raise HTTPException(400, "Choose an existing folder.")
    if row.get("status") in ("running", "blocked"):
        raise HTTPException(409, "Wait for the run to finish before moving this session.")
    if str(target) == row.get("cwd"):
        return _public(row)
    try:
        _, _, res = await session_call(sid, "session/relocate", {"cwd": str(target)})
    except HTTPException as e:
        if e.status_code == 409 and "Not a worktree" in str(e.detail):
            return JSONResponse(status_code=409, content={
                "detail": "Vibe moves a session only between checkouts of its repository, like a project and its worktrees.",
                "code": "other_repository"})
        raise
    if isinstance(res, dict) and res.get("state"):
        _persist(sid, res["state"])
    _store.upsert_session(sid, cwd=str(target))
    _store.audit("session.move", f"{sid} -> {target}")
    return _public(_store.get_session(sid))
