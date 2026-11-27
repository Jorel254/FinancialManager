/**
 * Smoke Etapa 5 — anti doble descuento + estados parcial/pagado.
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

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec(sql);

const pendingCat = "a3000001-0000-4000-8000-000000000001";
const expenseCat = "a2000001-0000-4000-8000-000000000006";
const pendingId = randomUUID();
const totalCents = 10_000;

db.prepare(
  `INSERT INTO pending_payments
    (id, description, total_amount_cents, due_on, category_id, priority,
     status, notes, created_at, updated_at)
   VALUES (?, 'Tarjeta smoke', ?, '2099-01-15', ?, 1, 'pending', NULL, ?, ?)`,
).run(pendingId, totalCents, pendingCat, new Date().toISOString(), new Date().toISOString());

const expensesBefore = db
  .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS t FROM expenses`)
  .get().t;
assert(expensesBefore === 0, "Registrar pendiente no debe crear egreso");

function applyPayment(amountCents) {
  const applicationId = randomUUID();
  const expenseId = randomUUID();
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `SELECT total_amount_cents,
              COALESCE((SELECT SUM(amount_cents) FROM payment_applications WHERE pending_payment_id = ?), 0) AS paid
       FROM pending_payments WHERE id = ?`,
    )
    .get(pendingId, pendingId);
  const remaining = row.total_amount_cents - row.paid;
  if (!(amountCents > 0 && amountCents <= remaining)) {
    throw new Error(`Monto inválido vs restante (${amountCents} > ${remaining})`);
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO expenses
        (id, description, amount_cents, spent_on, category_id, notes,
         pending_payment_id, payment_application_id, created_at, updated_at)
       VALUES (?, ?, ?, '2026-11-26', ?, NULL, ?, ?, ?, ?)`,
    ).run(
      expenseId,
      "Pago: Tarjeta smoke",
      amountCents,
      expenseCat,
      pendingId,
      applicationId,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO payment_applications
        (id, pending_payment_id, amount_cents, applied_on, notes, expense_id, created_at)
       VALUES (?, ?, ?, '2026-11-26', NULL, ?, ?)`,
    ).run(applicationId, pendingId, amountCents, expenseId, now);

    const paid = row.paid + amountCents;
    const status =
      paid <= 0 ? "pending" : paid >= row.total_amount_cents ? "paid" : "partial";
    db.prepare(
      `UPDATE pending_payments SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(status, now, pendingId);
  });
  tx();
  return { applicationId, expenseId };
}

applyPayment(4_000);
let status = db
  .prepare(`SELECT status FROM pending_payments WHERE id = ?`)
  .get(pendingId).status;
assert(status === "partial", `Esperaba partial, got ${status}`);

const expenseSum1 = db
  .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS t FROM expenses`)
  .get().t;
assert(expenseSum1 === 4_000, "Parcial debe crear egreso de 4000");

applyPayment(6_000);
status = db
  .prepare(`SELECT status FROM pending_payments WHERE id = ?`)
  .get(pendingId).status;
assert(status === "paid", `Esperaba paid, got ${status}`);

const expenseSum2 = db
  .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS t FROM expenses`)
  .get().t;
const appsSum = db
  .prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS t FROM payment_applications WHERE pending_payment_id = ?`,
  )
  .get(pendingId).t;

assert(expenseSum2 === 10_000, "Total egresos debe ser 10000 (una sola vez)");
assert(appsSum === expenseSum2, "Suma aplicaciones = suma egresos ligados");

const linked = db
  .prepare(
    `SELECT COUNT(*) AS c FROM expenses e
     JOIN payment_applications a ON a.id = e.payment_application_id
     WHERE e.pending_payment_id = ? AND a.expense_id = e.id`,
  )
  .get(pendingId).c;
assert(linked === 2, "Cada aplicación debe tener exactamente un egreso 1:1");

let overpayBlocked = false;
try {
  applyPayment(1);
} catch {
  overpayBlocked = true;
}
assert(overpayBlocked, "No debe permitir aplicar más que el restante");

console.log("OK smoke-pending-payments: anti doble descuento + parcial/pagado");
