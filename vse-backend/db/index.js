const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// DATABASE_PATH is the primary env var (matches Railway's persistent-volume
// convention, e.g. mounting a volume at /data and setting DATABASE_PATH=/data/vse.sqlite
// so the database survives redeploys instead of living on the container's ephemeral
// filesystem). SQLITE_DB_PATH is kept as a fallback for anyone already using the
// name from earlier in this project — same behavior, just an alias.
const dbPath = process.env.DATABASE_PATH || process.env.SQLITE_DB_PATH || path.join(__dirname, 'vse.sqlite');

// If DATABASE_PATH points into a volume directory that doesn't exist yet (first
// deploy before the volume has been written to), create it — better-sqlite3 will
// fail outright if the parent directory is missing, and Railway volumes are
// generally pre-mounted but this makes local/first-run setups robust too.
const dbDir = path.dirname(dbPath);
if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[vse-backend/db] using database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── Lightweight migrations (safe to run every startup) ──
// Add columns that may not exist on older databases. SQLite has no
// IF NOT EXISTS for ALTER TABLE, so catch the "duplicate column" error.
const migrations = [
    'ALTER TABLE payment_requests ADD COLUMN screenshot_path TEXT',
];
for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists — ok */ }
}

module.exports = db;
