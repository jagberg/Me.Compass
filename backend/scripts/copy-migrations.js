// tsc does not copy non-TS assets, so the *.sql migrations never reach dist/ on a clean
// build and 002_action_digest.sql (the digest columns/tables) would silently never run via
// the documented `npm run build && npm run start` path. Copy them explicitly after compile.
const { cpSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const src = join(__dirname, "..", "src", "db", "migrations");
const dest = join(__dirname, "..", "dist", "db", "migrations");
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copied migrations -> ${dest}`);
