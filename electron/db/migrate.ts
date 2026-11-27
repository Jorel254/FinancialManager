import type Database from "better-sqlite3";
import { migrations } from "./migrations";

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);

  const applied = new Set(
    db
      .prepare("SELECT id FROM schema_migrations ORDER BY id")
      .all()
      .map((row) => (row as { id: string }).id),
  );

  const insert = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  const applyAll = db.transaction(() => {
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      db.exec(migration.sql);
      insert.run(migration.id, new Date().toISOString());
    }
  });

  applyAll();
}
