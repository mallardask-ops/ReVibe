import vibedeck_server as server
from fastapi.testclient import TestClient


def test_only_installed_themes_and_sounds_are_offered(tmp_path, monkeypatch):
    stereo = tmp_path / "share" / "sounds" / "ocean" / "stereo"
    stereo.mkdir(parents=True)
    (stereo / "completion-success.oga").write_bytes(b"OggS done")
    # the first name is missing, so the fallback is used
    (stereo / "message-attention.oga").write_bytes(b"OggS attention")
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("XDG_DATA_DIRS", str(tmp_path / "share"))
    with TestClient(server.app, base_url="http://127.0.0.1:9377") as client:
        themes = client.get("/api/sounds").json()["themes"]
        assert [(t["id"], t["events"]) for t in themes] == [("ocean", ["done", "attention"])]
        sound = client.get("/api/sounds/ocean/attention")
        assert sound.status_code == 200
        assert sound.headers["content-type"] == "audio/ogg"
        assert sound.content == b"OggS attention"
        assert client.get("/api/sounds/ocean/failed").status_code == 404
        assert client.get("/api/sounds/freedesktop/done").status_code == 404
        assert client.get("/api/sounds/..%2F..%2Fetc/passwd").status_code == 404
