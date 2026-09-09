// One command to view the app locally / over the tunnel: build backend + frontend, copy the
// built UI into backend/public, free port 3000 (killing only the process that owns it, not every
// node), then start the server in the foreground.
//
//   cd backend && npm run serve
//
const { execSync, spawnSync } = require("node:child_process");
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const backend = join(__dirname, "..");
const frontend = join(backend, "..", "frontend");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, cmd, args, cwd) {
  console.log(`\n> ${label}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`${label} failed`);
    process.exit(r.status ?? 1);
  }
}

// 1. Build both (backend build also copies the SQL migrations into dist).
run("build backend", npm, ["run", "build"], backend);
run("build frontend", npm, ["run", "build"], frontend);

// 2. Serve the freshly built UI from the backend (same origin as /api, so the phone needs no CORS).
const dist = join(frontend, "dist");
const publicDir = join(backend, "public");
if (!existsSync(dist)) {
  console.error(`frontend build missing at ${dist}`);
  process.exit(1);
}
cpSync(dist, publicDir, { recursive: true });
console.log(`copied UI -> ${publicDir}`);

// 3. Free port 3000 by killing only its listener (Windows-specific; skipped elsewhere).
if (process.platform === "win32") {
  try {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (/:3000\s/.test(line) && /LISTENING/i.test(line)) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`);
        console.log(`freed port 3000 (killed pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* netstat unavailable; let the listen call surface any conflict */
  }
}

// 4. Start the server in the foreground (Ctrl+C stops it).
console.log("\n> starting server on http://0.0.0.0:3000");
const server = spawnSync("node", ["dist/main.js"], { cwd: backend, stdio: "inherit" });
process.exit(server.status ?? 0);
