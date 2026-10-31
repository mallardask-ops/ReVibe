// Packaged builds (AppImage, Windows installer) carry the sidecar as a
// PyInstaller bundle in resources/sidecar and start it themselves. A checkout
// or the script install keeps using the launcher, which starts it first.
const { app } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

let child = null;

async function healthy(url) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch { return false; }
}

/** Starts the bundled sidecar unless one already answers on the port; resolves once it is up. */
async function ensureSidecar(url, port) {
  if (!app.isPackaged || await healthy(url)) return;
  const exe = path.join(process.resourcesPath, "sidecar", process.platform === "win32" ? "revibe-sidecar.exe" : "revibe-sidecar");
  child = spawn(exe, [], {
    env: { ...process.env, VIBEDECK_PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("exit", () => { child = null; });
  // the window retries loading on its own; this only shortens a cold start
  for (let i = 0; i < 40 && child; i++) {
    if (await healthy(url)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

function stopSidecar() {
  if (child && !child.killed) child.kill();
  child = null;
}

module.exports = { ensureSidecar, stopSidecar };
