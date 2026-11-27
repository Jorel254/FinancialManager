import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Migration {
  id: string;
  sql: string;
}

const dir = dirname(fileURLToPath(import.meta.url));
const sql001 = readFileSync(join(dir, "001_initial.sql"), "utf8");
const sql002 = readFileSync(join(dir, "002_app_settings.sql"), "utf8");

/** Migraciones ordenadas por id lexicográfico. */
export const migrations: Migration[] = [
  { id: "001_initial", sql: sql001 },
  { id: "002_app_settings", sql: sql002 },
];
