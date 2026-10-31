"""Bundles the sidecar and the built frontend into build/sidecar/ with
PyInstaller, for the AppImage and the Windows installer.

    cd frontend && pnpm build && cd ..
    uv run --with pyinstaller python packaging/build_sidecar.py

The result is a folder holding ``revibe-sidecar`` (``.exe`` on Windows) and
its files; electron-builder copies it into the app's resources.
"""
import os
import shutil
from pathlib import Path

import PyInstaller.__main__

ROOT = Path(__file__).resolve().parent.parent
SIDECAR = ROOT / "sidecar"
DIST = ROOT / "frontend" / "dist"
OUT = ROOT / "build"


def data(source: Path, target: str) -> list[str]:
    return ["--add-data", f"{source}{os.pathsep}{target}"]


def main() -> None:
    if not (DIST / "index.html").is_file():
        raise SystemExit("Build the frontend first: cd frontend && pnpm build")
    shutil.rmtree(OUT / "sidecar", ignore_errors=True)
    PyInstaller.__main__.run([
        str(SIDECAR / "run_sidecar.py"),
        "--name", "revibe-sidecar",
        "--onedir", "--noconfirm", "--clean",
        "--paths", str(SIDECAR),
        "--distpath", str(OUT / "pyinstaller-dist"),
        "--workpath", str(OUT / "pyinstaller-work"),
        "--specpath", str(OUT),
        # the frontend, and files the sidecar copies into Vibe's config
        *data(DIST, "dist"),
        *data(SIDECAR / "provider_tools", "provider_tools"),
        *data(SIDECAR / "agent_routing.py", "."),
        "--collect-submodules", "uvicorn",
        "--collect-submodules", "keyring",
        "--collect-submodules", "sidecar",
    ])
    shutil.move(str(OUT / "pyinstaller-dist" / "revibe-sidecar"), str(OUT / "sidecar"))
    print("sidecar bundle:", OUT / "sidecar")


if __name__ == "__main__":
    main()
