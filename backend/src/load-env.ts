// Load the single root .env before anything else reads process.env. Import this FIRST in main.ts
// (and it is imported by config/connection consumers indirectly). Node's built-in loader — no
// dependency. From dist/load-env.js or src/load-env.ts, the repo root is two levels up.
import { join } from "node:path";

try {
  process.loadEnvFile(join(__dirname, "..", "..", ".env"));
} catch {
  // No .env (e.g. CI, or vars supplied by the environment/docker-compose) — fall back to real env.
}
