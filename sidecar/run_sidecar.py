"""Entry point for the packaged sidecar (PyInstaller): serves the API and the
bundled frontend on 127.0.0.1:$VIBEDECK_PORT (9377 by default)."""
import os

import uvicorn
from vibedeck_server import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("VIBEDECK_PORT", "9377")), log_level="info")
