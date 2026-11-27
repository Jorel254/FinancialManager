import { app } from "electron";
import Database from "better-sqlite3";
import { join } from "node:path";
import { runMigrations } from "./migrate";

let db: Database.Database | null = null;

export function getDbPath(): string {
  return join(app.getPath("userData"), "financial-manager.sqlite");
}

export function openDatabase(): Database.Database {
  if (db) return db;

  const filePath = getDbPath();
  db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("La base de datos no está abierta. Llama openDatabase() primero.");
  }
  return db;
}

export function closeDatabase(): void {
  if (!db) return;
  db.close();
  db = null;
}
