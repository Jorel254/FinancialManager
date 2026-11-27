/**
 * Smoke Etapa 7 — filtros de historial (UNION incomes/expenses/pending/apps).
 * Corre sin Electron: better-sqlite3 en memoria + SQL de migración.
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(
  join(root, "electron/db/migrations/001_initial.sql"),
  "utf8",
);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

const incomeCat = "a1000001-0000-4000-8000-000000000001";
const expenseCat = "a2000001-0000-4000-8000-000000000001";
const pendingCat = "a3000001-0000-4000-8000-000000000001";

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec(sql);

const now = new Date().toISOString();
const incomeId = randomUUID();
const expenseId = randomUUID();
const pendingId = randomUUID();
const applicationId = randomUUID();
const linkedExpenseId = randomUUID();

db.prepare(
  `INSERT INTO incomes
    (id, description, amount_cents, received_on, category_id, notes, created_at, updated_at)
   VALUES (?, 'Nómina noviembre', 500000, '2026-11-01', ?, NULL, ?, ?)`,
).run(incomeId, incomeCat, now, now);

db.prepare(
  `INSERT INTO expenses
    (id, description, amount_cents, spent_on, category_id, notes,
     pending_payment_id, payment_application_id, created_at, updated_at)
   VALUES (?, 'Supermercado', 25000, '2026-11-10', ?, NULL, NULL, NULL, ?, ?)`,
).run(expenseId, expenseCat, now, now);

db.prepare(
  `INSERT INTO pending_payments
    (id, description, total_amount_cents, due_on, category_id, priority,
     status, notes, created_at, updated_at)
   VALUES (?, 'Tarjeta crédito', 100000, '2026-11-20', ?, 1, 'partial', NULL, ?, ?)`,
).run(pendingId, pendingCat, now, now);

db.prepare(
  `INSERT INTO expenses
    (id, description, amount_cents, spent_on, category_id, notes,
     pending_payment_id, payment_application_id, created_at, updated_at)
   VALUES (?, 'Pago: Tarjeta crédito', 40000, '2026-11-15', ?, NULL, ?, ?, ?, ?)`,
).run(linkedExpenseId, expenseCat, pendingId, applicationId, now, now);

db.prepare(
  `INSERT INTO payment_applications
    (id, pending_payment_id, amount_cents, applied_on, notes, expense_id, created_at)
   VALUES (?, ?, 40000, '2026-11-15', NULL, ?, ?)`,
).run(applicationId, pendingId, linkedExpenseId, now);

function queryHistory(filters = {}) {
  const where = [];
  const params = [];
  if (filters.type) {
    where.push("h.type = ?");
    params.push(filters.type);
  }
  if (filters.categoryId) {
    where.push("h.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.from) {
    where.push("h.date >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("h.date <= ?");
    params.push(filters.to);
  }
  if (filters.query) {
    where.push("h.description LIKE ? COLLATE NOCASE");
    params.push(`%${filters.query}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return db
    .prepare(
      `
    SELECT h.id, h.type, h.description, h.amount_cents, h.date, h.category_id
    FROM (
      SELECT i.id, 'income' AS type, i.description, i.amount_cents,
             i.received_on AS date, i.category_id, i.created_at
      FROM incomes i
      UNION ALL
      SELECT e.id, 'expense', e.description, e.amount_cents, e.spent_on,
             e.category_id, e.created_at
      FROM expenses e
      UNION ALL
      SELECT pp.id, 'pending', pp.description, pp.total_amount_cents, pp.due_on,
             pp.category_id, pp.created_at
      FROM pending_payments pp
      UNION ALL
      SELECT pa.id, 'application', pp.description, pa.amount_cents, pa.applied_on,
             pp.category_id, pa.created_at
      FROM payment_applications pa
      INNER JOIN pending_payments pp ON pp.id = pa.pending_payment_id
    ) h
    ${whereSql}
    ORDER BY h.date DESC, h.created_at DESC
  `,
    )
    .all(...params);
}

const all = queryHistory();
// ingreso + egreso manual + egreso ligado + pendiente + aplicación = 5
assert(all.length === 5, `Esperaba 5 filas, got ${all.length}`);

const onlyIncome = queryHistory({ type: "income" });
assert(onlyIncome.length === 1 && onlyIncome[0].type === "income", "Filtro type=income");

const onlyApps = queryHistory({ type: "application" });
assert(
  onlyApps.length === 1 && onlyApps[0].amount_cents === 40000,
  "Filtro type=application",
);

const onlyPending = queryHistory({ type: "pending" });
assert(onlyPending.length === 1 && onlyPending[0].id === pendingId, "Filtro type=pending");

const byRange = queryHistory({ from: "2026-11-10", to: "2026-11-16" });
// egreso manual 11-10 + egreso ligado 11-15 + aplicación 11-15
assert(
  byRange.length === 3 &&
    byRange.every((r) => r.date >= "2026-11-10" && r.date <= "2026-11-16"),
  "Filtro rango de fechas",
);

const byQuery = queryHistory({ query: "tarjeta" });
// pendiente + aplicación (misma descripción) + egreso "Pago: Tarjeta…"
assert(
  byQuery.length === 3 &&
    byQuery.every((r) => /tarjeta/i.test(r.description)),
  "Búsqueda por descripción",
);

const byCategory = queryHistory({ categoryId: incomeCat });
assert(
  byCategory.length === 1 && byCategory[0].type === "income",
  "Filtro por categoría",
);

const expenses = queryHistory({ type: "expense" });
assert(expenses.length === 2, "Dos egresos (manual + ligado a pago)");

console.log("OK smoke-history: filtros tipo/categoría/fechas/descripción");
