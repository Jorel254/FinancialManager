/**
 * Smoke Etapa 8 — flujos reales vía repositorios (sin Electron).
 * Uso: npm run smoke:etapa8
 */
import assert from "node:assert/strict";
import { closeDatabase, openDatabaseAt } from "../electron/db/connection";
import { isDbError } from "../electron/db/errors";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "../electron/db/repositories/expenses";
import { getFinanceSummary } from "../electron/db/repositories/finance";
import { queryHistory } from "../electron/db/repositories/history";
import {
  createIncome,
  deleteIncome,
  updateIncome,
} from "../electron/db/repositories/incomes";
import {
  applyPayment,
  createPendingPayment,
  deletePendingPayment,
  listPendingPayments,
  removeApplication,
  updatePendingPayment,
} from "../electron/db/repositories/pending-payments";
import { requireIsoDate, requirePositiveCents } from "../electron/db/validation";
import { parsePesosInput } from "../src/lib/money-input";
import { parsePesosDecimalString, pesosToCents } from "../shared/money";

const INCOME_CAT = "a1000001-0000-4000-8000-000000000001";
const EXPENSE_CAT = "a2000001-0000-4000-8000-000000000001";
const PENDING_CAT = "a3000001-0000-4000-8000-000000000001";
const WRONG_KIND_CAT = EXPENSE_CAT;
const MONTH = "2026-11";

function expectFail(fn: () => unknown, code?: string): void {
  try {
    fn();
    assert.fail("Se esperaba un error");
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.ok(isDbError(error), `Error no tipado DbError: ${String(error)}`);
    if (code) {
      assert.equal(
        error.code,
        code,
        `Código esperado ${code}, got ${error.code}`,
      );
    }
  }
}

openDatabaseAt(":memory:", { fresh: true });

// --- Validaciones IPC (montos / fechas) ---
expectFail(() => requirePositiveCents(0), "VALIDATION");
expectFail(() => requirePositiveCents(-100), "VALIDATION");
expectFail(() => requirePositiveCents(10.5), "VALIDATION");
expectFail(
  () => requirePositiveCents("100" as unknown as number),
  "VALIDATION",
);
expectFail(() => requireIsoDate("2026-13-01", "receivedOn"), "VALIDATION");
expectFail(() => requireIsoDate("2026-02-30", "receivedOn"), "VALIDATION");
expectFail(() => requireIsoDate("26-11-01", "receivedOn"), "VALIDATION");
assert.equal(requireIsoDate("2026-11-26", "receivedOn"), "2026-11-26");
assert.equal(pesosToCents(19.99), 1999);
assert.equal(parsePesosDecimalString("1250.50"), 125050);
assert.equal(parsePesosDecimalString("10"), 1000);
assert.equal(parsePesosInput("19.99"), 1999);
assert.equal(parsePesosInput("1,250.50"), 125_050);
assert.equal(parsePesosInput("1250,50"), 125_050);
assert.equal(parsePesosInput("0"), null);
assert.equal(parsePesosInput("-5"), null);
assert.equal(parsePesosInput("1.005"), null);
assert.equal(parsePesosInput("abc"), null);

// --- Ingresos / egresos / saldo ---
const income = createIncome({
  description: "Nómina smoke E8",
  amountCents: 500_000,
  receivedOn: "2026-11-01",
  categoryId: INCOME_CAT,
  notes: null,
});
const expense = createExpense({
  description: "Supermercado smoke E8",
  amountCents: 25_000,
  spentOn: "2026-11-10",
  categoryId: EXPENSE_CAT,
  notes: null,
});

expectFail(
  () =>
    createIncome({
      description: "Mal kind",
      amountCents: 1000,
      receivedOn: "2026-11-02",
      categoryId: WRONG_KIND_CAT,
      notes: null,
    }),
  "VALIDATION",
);

let summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 475_000);
assert.equal(summary.summary.incomeMonthCents, 500_000);
assert.equal(summary.summary.expenseMonthCents, 25_000);

updateIncome(income.id, { amountCents: 520_000 });
summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 495_000);

// --- Pendiente no mueve saldo ---
const pending = createPendingPayment({
  description: "Tarjeta smoke E8",
  totalAmountCents: 100_000,
  dueOn: "2026-11-20",
  categoryId: PENDING_CAT,
  priority: 1,
  notes: null,
});
summary = getFinanceSummary(MONTH);
assert.equal(
  summary.summary.availableBalanceCents,
  495_000,
  "Crear pendiente no debe cambiar saldo",
);
assert.equal(summary.summary.committedMonthCents, 100_000);
assert.equal(summary.summary.projectedBalanceCents, 395_000);

// --- Parcial ---
const partial = applyPayment({
  pendingPaymentId: pending.id,
  amountCents: 40_000,
  appliedOn: "2026-11-15",
  notes: null,
});
assert.equal(partial.expense.amountCents, 40_000);
assert.equal(partial.expense.pendingPaymentId, pending.id);
assert.equal(partial.application.expenseId, partial.expense.id);

const afterPartial = listPendingPayments().find((p) => p.id === pending.id);
assert.ok(afterPartial);
assert.equal(afterPartial.status, "partial");
assert.equal(afterPartial.remainingCents, 60_000);

summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 455_000);
assert.equal(summary.summary.committedMonthCents, 60_000);
assert.equal(summary.summary.expenseMonthCents, 65_000);

expectFail(
  () =>
    applyPayment({
      pendingPaymentId: pending.id,
      amountCents: 60_001,
      appliedOn: "2026-11-16",
    }),
  "VALIDATION",
);

expectFail(
  () => updateExpense(partial.expense.id, { amountCents: 1 }),
  "CONFLICT",
);
expectFail(() => deleteExpense(partial.expense.id), "CONFLICT");

// --- Liquidación total del restante ---
applyPayment({
  pendingPaymentId: pending.id,
  amountCents: 60_000,
  appliedOn: "2026-11-18",
});
const afterPaid = listPendingPayments().find((p) => p.id === pending.id);
assert.ok(afterPaid);
assert.equal(afterPaid.status, "paid");
assert.equal(afterPaid.remainingCents, 0);

summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 395_000);
assert.equal(summary.summary.committedMonthCents, 0);
assert.equal(
  summary.summary.expenseMonthCents,
  125_000,
  "Egresos = manual 25k + apps 100k",
);

expectFail(
  () =>
    applyPayment({
      pendingPaymentId: pending.id,
      amountCents: 1,
      appliedOn: "2026-11-19",
    }),
  "CONFLICT",
);

// --- Deshacer última aplicación → vuelve a partial ---
const lastApp = afterPaid.applications[afterPaid.applications.length - 1];
removeApplication(lastApp.id);
const afterUndo = listPendingPayments().find((p) => p.id === pending.id);
assert.ok(afterUndo);
assert.equal(afterUndo.status, "partial");
assert.equal(afterUndo.remainingCents, 60_000);
summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 455_000);

// --- Editar total < pagado rechazado ---
expectFail(
  () => updatePendingPayment(pending.id, { totalAmountCents: 10_000 }),
  "VALIDATION",
);

// --- Historial ---
const historyAll = queryHistory({});
assert.ok(historyAll.length >= 4);
const incomes = queryHistory({ type: "income" });
assert.equal(incomes.length, 1);
const apps = queryHistory({ type: "application" });
assert.equal(apps.length, 1);
assert.equal(apps[0]?.amountCents, 40_000);

const byQuery = queryHistory({ query: "tarjeta" });
assert.ok(byQuery.every((row) => /tarjeta/i.test(row.description)));
assert.ok(byQuery.length >= 2);

// Sin escape, query "%" se volvería comodín y devolvería todo.
const allBeforeLiteral = queryHistory({});
assert.ok(allBeforeLiteral.length > 0);
const literalPercent = queryHistory({ query: "%" });
assert.equal(
  literalPercent.length,
  0,
  "LIKE debe tratar % del usuario como literal (no comodín)",
);
createIncome({
  description: "Promo 50% off",
  amountCents: 100,
  receivedOn: "2026-11-12",
  categoryId: INCOME_CAT,
  notes: null,
});
const withPercent = queryHistory({ query: "%" });
assert.equal(withPercent.length, 1);
assert.ok(withPercent[0]?.description.includes("%"));
deleteIncome(withPercent[0]!.id);

expectFail(
  () => queryHistory({ from: "2026-11-20", to: "2026-11-01" }),
  "VALIDATION",
);

// --- Borrar pendiente con aplicación: cascada y saldo ---
const balanceBeforeDelete =
  getFinanceSummary(MONTH).summary.availableBalanceCents;
deletePendingPayment(pending.id);
summary = getFinanceSummary(MONTH);
assert.equal(
  summary.summary.availableBalanceCents,
  balanceBeforeDelete + 40_000,
  "Cascada debe devolver el egreso ligado al saldo",
);
assert.equal(summary.summary.committedMonthCents, 0);

// --- CRUD delete ingreso/egreso manual ---
deleteExpense(expense.id);
deleteIncome(income.id);
summary = getFinanceSummary(MONTH);
assert.equal(summary.summary.availableBalanceCents, 0);
assert.equal(summary.summary.incomeMonthCents, 0);
assert.equal(summary.summary.expenseMonthCents, 0);

// --- Urgencia / orden próximos pagos ---
createPendingPayment({
  description: "Vencido",
  totalAmountCents: 1000,
  dueOn: "2026-01-01",
  categoryId: PENDING_CAT,
  priority: 3,
  notes: null,
});
createPendingPayment({
  description: "Lejano",
  totalAmountCents: 1000,
  dueOn: "2099-12-01",
  categoryId: PENDING_CAT,
  priority: 1,
  notes: null,
});
const { upcoming } = getFinanceSummary(MONTH);
assert.ok(upcoming.length >= 2);
assert.equal(upcoming[0]?.description, "Vencido");
assert.equal(upcoming[0]?.urgency, "overdue");
assert.equal(upcoming[upcoming.length - 1]?.description, "Lejano");

closeDatabase();
console.log(
  "OK smoke-etapa-8: validaciones, ingresos/egresos, parcial/pagado, dashboard, historial",
);
