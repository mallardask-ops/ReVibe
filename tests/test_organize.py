import pytest
import vibedeck_server as server
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_pin_keeps_the_activity_order():
    sid = (await server.create_session(server.SessionCreate(cwd="/tmp")))["id"]
    before = server.store.get_session(sid)["updated_at"]
    pinned = await server.organize.pin(sid, server.organize.PinReq(pinned=True))
    assert pinned["pinned_at"] and pinned["updated_at"] == before
    assert (await server.organize.pin(sid, server.organize.PinReq(pinned=False)))["pinned_at"] is None
    await server.manager.close(sid)
    await server._stop_tap(sid)


@pytest.mark.asyncio
async def test_move_relocates_the_vibe_session(tmp_path):
    sid = (await server.create_session(server.SessionCreate(cwd="/tmp")))["id"]
    moved = await server.organize.move(sid, server.organize.MoveReq(cwd=str(tmp_path)))
    assert moved["cwd"] == str(tmp_path)
    bridge = server.manager.get(sid)
    assert ("session/relocate", {"sessionId": bridge.session_id or sid, "cwd": str(tmp_path)}) in bridge.calls
    with pytest.raises(HTTPException) as missing:
        await server.organize.move(sid, server.organize.MoveReq(cwd=str(tmp_path / "nope")))
    assert missing.value.status_code == 400
    server.store.upsert_session(sid, status="running")
    with pytest.raises(HTTPException) as busy:
        await server.organize.move(sid, server.organize.MoveReq(cwd="/tmp"))
    assert busy.value.status_code == 409
    server.store.upsert_session(sid, status="idle")
    await server.manager.close(sid)
    await server._stop_tap(sid)
