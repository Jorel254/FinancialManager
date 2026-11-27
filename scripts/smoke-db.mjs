/**
 * Smoke test local de migraciones + CRUD mínimo (sin Electron).
 * Uso: node scripts/smoke-db.mjs
 */
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const dir = mkdtempSync(join(tmpdir(), "fm-smoke-"));
const dbPath = join(dir, "financial-manager.sqlite");
const sql001 = readFileSync(
  new URL("../electron/db/migrations/001_initial.sql", import.meta.url),
  "utf8",
);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  );
`);

db.transaction(() => {
  db.exec(sql001);
  db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  ).run("001_initial", new Date().toISOString());
})();

const categories = db
  .prepare("SELECT COUNT(*) AS n FROM categories")
  .get();
if (categories.n !== 15) {
  throw new Error(`Se esperaban 15 categorías, hay ${categories.n}`);
}

const incomeCat = db
  .prepare("SELECT id FROM categories WHERE kind = 'income' LIMIT 1")
  .get().id;
const expenseCat = db
  .prepare("SELECT id FROM categories WHERE kind = 'expense' LIMIT 1")
  .get().id;

const now = new Date().toISOString();
const incomeId = randomUUID();
db.prepare(
  `INSERT INTO incomes
    (id, description, amount_cents, received_on, category_id, notes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
).run(incomeId, "Nómina smoke", 10_000_00, "2026-11-01", incomeCat, now, now);

const expenseId = randomUUID();
db.prepare(
  `INSERT INTO expenses
    (id, description, amount_cents, spent_on, category_id, notes,
     pending_payment_id, payment_application_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
).run(expenseId, "Comida smoke", 250_00, "2026-11-05", expenseCat, now, now);

const incomeSum = db
  .prepare("SELECT COALESCE(SUM(amount_cents),0) AS t FROM incomes")
  .get().t;
const expenseSum = db
  .prepare("SELECT COALESCE(SUM(amount_cents),0) AS t FROM expenses")
  .get().t;
const available = incomeSum - expenseSum;
if (available !== 9_750_00) {
  throw new Error(`Saldo esperado 975000, got ${available}`);
}

db.close();
rmSync(dir, { recursive: true, force: true });
console.log("smoke-db OK — migraciones, seed y CRUD básico");
