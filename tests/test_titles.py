import pytest
import vibedeck_server as server


@pytest.mark.asyncio
async def test_first_message_names_the_session_until_vibe_does():
    sid = (await server.create_session(server.SessionCreate(cwd="/tmp")))["id"]
    assert server.store.get_session(sid)["title"] == "Session in tmp"
    await server.send_turn(sid, server.TurnReq(text="\n  Fix the flaky login test in auth.py  \nmore detail", requestId="t1"))
    assert server.store.get_session(sid)["title"] == "Fix the flaky login test in auth.py"
    # Vibe's generated title replaces it
    server._adopt_title(sid, "Flaky login test")
    assert server.store.get_session(sid)["title"] == "Flaky login test"
    await server.manager.close(sid)
    await server._stop_tap(sid)


@pytest.mark.asyncio
async def test_a_name_the_user_chose_is_kept(monkeypatch):
    sid = (await server.create_session(server.SessionCreate(cwd="/tmp")))["id"]
    await server.patch_session(sid, server.SessionPatch(title="My name"))
    server._adopt_title(sid, "Generated")
    await server.send_turn(sid, server.TurnReq(text="Something else", requestId="t2"))
    assert server.store.get_session(sid)["title"] == "My name"
    named = (await server.create_session(server.SessionCreate(cwd="/tmp", title="Given")))["id"]
    server._adopt_title(named, "Generated")
    assert server.store.get_session(named)["title"] == "Given"
    for s in (sid, named):
        await server.manager.close(s)
        await server._stop_tap(s)


def test_long_first_lines_are_shortened():
    title = server._first_line_title("x" * 200)
    assert len(title) == server.TITLE_MAX and title.endswith("…")
