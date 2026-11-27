import Database from "better-sqlite3";
import { createRequire } from "node:module";
import { join } from "node:path";
import { runMigrations } from "./migrate";

let db: Database.Database | null = null;

/**
 * Ruta de la DB en userData de Electron.
 * Solo se llama desde el proceso main (no en smokes).
 */
export function getDbPath(): string {
  const require = createRequire(import.meta.url);
  const electron = require("electron") as typeof import("electron");
  return join(electron.app.getPath("userData"), "financial-manager.sqlite");
}

/**
 * Abre la DB en una ruta concreta (archivo o `:memory:`).
 * Usado por smokes/tests sin arrancar Electron.
 */
export function openDatabaseAt(
  filePath: string,
  options: { fresh?: boolean } = {},
): Database.Database {
  if (options.fresh && db) {
    closeDatabase();
  }
  if (db) return db;

  db = new Database(filePath);
  // En `:memory:` SQLite puede ignorar WAL y usar mode=memory.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function openDatabase(): Database.Database {
  return openDatabaseAt(getDbPath());
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error(
      "La base de datos no está abierta. Llama openDatabase() primero.",
    );
  }
  return db;
}

export function closeDatabase(): void {
  if (!db) return;
  db.close();
  db = null;
}
