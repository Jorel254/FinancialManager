import { randomUUID } from "node:crypto";
import type {
  Expense,
  PaymentApplication,
  PaymentPriority,
  PendingPayment,
  PendingPaymentStatus,
  PendingPaymentView,
} from "../../../shared/models";
import { urgencyFor, urgencyRank } from "../../../shared/due";
import { getDatabase } from "../connection";
import { DbError } from "../errors";
import {
  optionalNotes,
  requireIsoDate,
  requireNonEmpty,
  requirePositiveCents,
  todayLocalIsoDate,
} from "../validation";
import { requireCategoryOfKind } from "./categories";

interface PendingRow {
  id: string;
  description: string;
  total_amount_cents: number;
  due_on: string;
  category_id: string;
  priority: PaymentPriority;
  status: PendingPaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_cents: number;
  remaining_cents: number;
}

interface ApplicationRow {
  id: string;
  pending_payment_id: string;
  amount_cents: number;
  applied_on: string;
  notes: string | null;
  expense_id: string;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount_cents: number;
  spent_on: string;
  category_id: string;
  notes: string | null;
  pending_payment_id: string | null;
  payment_application_id: string | null;
  created_at: string;
  updated_at: string;
}

type PendingCreateInput = Omit<
  PendingPayment,
  "id" | "status" | "createdAt" | "updatedAt"
>;
type PendingUpdateInput = Partial<PendingCreateInput>;

const FALLBACK_EXPENSE_CATEGORY_ID = "a2000001-0000-4000-8000-000000000006";

function mapApplication(row: ApplicationRow): PaymentApplication {
  return {
    id: row.id,
    pendingPaymentId: row.pending_payment_id,
    amountCents: row.amount_cents,
    appliedOn: row.applied_on,
    notes: row.notes,
    expenseId: row.expense_id,
    createdAt: row.created_at,
  };
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    spentOn: row.spent_on,
    categoryId: row.category_id,
    notes: row.notes,
    pendingPaymentId: row.pending_payment_id,
    paymentApplicationId: row.payment_application_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requirePriority(value: unknown): PaymentPriority {
  if (value === 1 || value === 2 || value === 3) return value;
  throw new DbError("VALIDATION", "priority debe ser 1, 2 o 3");
}

function statusFromPaid(
  totalCents: number,
  paidCents: number,
): PendingPaymentStatus {
  if (paidCents <= 0) return "pending";
  if (paidCents >= totalCents) return "paid";
  return "partial";
}

function listApplicationsFor(pendingId: string): PaymentApplication[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, pending_payment_id, amount_cents, applied_on, notes,
              expense_id, created_at
       FROM payment_applications
       WHERE pending_payment_id = ?
       ORDER BY applied_on ASC, created_at ASC`,
    )
    .all(pendingId) as ApplicationRow[];
  return rows.map(mapApplication);
}

function getPendingRow(id: string): PendingRow | undefined {
  return getDatabase()
    .prepare(
      `SELECT
         pp.id,
         pp.description,
         pp.total_amount_cents,
         pp.due_on,
         pp.category_id,
         pp.priority,
         pp.status,
         pp.notes,
         pp.created_at,
         pp.updated_at,
         COALESCE(paid.paid_cents, 0) AS paid_cents,
         (pp.total_amount_cents - COALESCE(paid.paid_cents, 0)) AS remaining_cents
       FROM pending_payments pp
       LEFT JOIN (
         SELECT pending_payment_id, SUM(amount_cents) AS paid_cents
         FROM payment_applications
         GROUP BY pending_payment_id
       ) paid ON paid.pending_payment_id = pp.id
       WHERE pp.id = ?`,
    )
    .get(id) as PendingRow | undefined;
}

function toView(row: PendingRow): PendingPaymentView {
  return {
    id: row.id,
    description: row.description,
    totalAmountCents: row.total_amount_cents,
    dueOn: row.due_on,
    categoryId: row.category_id,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidCents: row.paid_cents,
    remainingCents: row.remaining_cents,
    applications: listApplicationsFor(row.id),
  };
}

function sortPendingViews(items: PendingPaymentView[]): PendingPaymentView[] {
  const today = todayLocalIsoDate();
  return [...items].sort((a, b) => {
    const aOpen = a.status !== "paid";
    const bOpen = b.status !== "paid";
    if (aOpen !== bOpen) return aOpen ? -1 : 1;

    if (aOpen && bOpen) {
      const urg =
        urgencyRank(urgencyFor(a.dueOn, today)) -
        urgencyRank(urgencyFor(b.dueOn, today));
      if (urg !== 0) return urg;
      if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt < b.createdAt ? -1 : 1;
    }

    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt > b.updatedAt ? -1 : 1;
    }
    return a.createdAt > b.createdAt ? -1 : 1;
  });
}

function resolveExpenseCategoryId(pendingCategoryId: string): string {
  const db = getDatabase();
  const pendingCat = db
    .prepare(`SELECT name FROM categories WHERE id = ?`)
    .get(pendingCategoryId) as { name: string } | undefined;

  if (pendingCat) {
    const match = db
      .prepare(
        `SELECT id FROM categories
         WHERE kind = 'expense' AND name = ?
         LIMIT 1`,
      )
      .get(pendingCat.name) as { id: string } | undefined;
    if (match) return match.id;
  }

  const fallback = db
    .prepare(
      `SELECT id FROM categories
       WHERE id = ? OR (kind = 'expense' AND name = 'Otros')
       ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get(FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_EXPENSE_CATEGORY_ID) as
    | { id: string }
    | undefined;

  if (!fallback) {
    throw new DbError(
      "INTERNAL",
      "No hay categoría de egreso para registrar la liquidación",
    );
  }
  return fallback.id;
}

function syncPendingStatus(pendingId: string, updatedAt: string): void {
  const row = getPendingRow(pendingId);
  if (!row) return;
  const next = statusFromPaid(row.total_amount_cents, row.paid_cents);
  getDatabase()
    .prepare(
      `UPDATE pending_payments SET status = ?, updated_at = ? WHERE id = ?`,
    )
    .run(next, updatedAt, pendingId);
}

export function listPendingPayments(): PendingPaymentView[] {
  const rows = getDatabase()
    .prepare(
      `SELECT
         pp.id,
         pp.description,
         pp.total_amount_cents,
         pp.due_on,
         pp.category_id,
         pp.priority,
         pp.status,
         pp.notes,
         pp.created_at,
         pp.updated_at,
         COALESCE(paid.paid_cents, 0) AS paid_cents,
         (pp.total_amount_cents - COALESCE(paid.paid_cents, 0)) AS remaining_cents
       FROM pending_payments pp
       LEFT JOIN (
         SELECT pending_payment_id, SUM(amount_cents) AS paid_cents
         FROM payment_applications
         GROUP BY pending_payment_id
       ) paid ON paid.pending_payment_id = pp.id`,
    )
    .all() as PendingRow[];

  return sortPendingViews(rows.map(toView));
}

export function createPendingPayment(
  input: PendingCreateInput,
): PendingPaymentView {
  const description = requireNonEmpty(input.description, "description");
  const totalAmountCents = requirePositiveCents(
    input.totalAmountCents,
    "totalAmountCents",
  );
  const dueOn = requireIsoDate(input.dueOn, "dueOn");
  const categoryId = requireNonEmpty(input.categoryId, "categoryId");
  requireCategoryOfKind(categoryId, "pending_payment");
  const priority = requirePriority(input.priority ?? 2);
  const notes = optionalNotes(input.notes);

  const now = new Date().toISOString();
  const id = randomUUID();

  getDatabase()
    .prepare(
      `INSERT INTO pending_payments
        (id, description, total_amount_cents, due_on, category_id, priority,
         status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(
      id,
      description,
      totalAmountCents,
      dueOn,
      categoryId,
      priority,
      notes,
      now,
      now,
    );

  const row = getPendingRow(id);
  if (!row) {
    throw new DbError("INTERNAL", "No se pudo leer el pago pendiente creado");
  }
  return toView(row);
}

export function updatePendingPayment(
  id: string,
  input: PendingUpdateInput,
): PendingPaymentView {
  const existing = getPendingRow(id);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Pago pendiente no encontrado");
  }

  const description =
    input.description !== undefined
      ? requireNonEmpty(input.description, "description")
      : existing.description;
  const totalAmountCents =
    input.totalAmountCents !== undefined
      ? requirePositiveCents(input.totalAmountCents, "totalAmountCents")
      : existing.total_amount_cents;
  const dueOn =
    input.dueOn !== undefined
      ? requireIsoDate(input.dueOn, "dueOn")
      : existing.due_on;
  const categoryId =
    input.categoryId !== undefined
      ? requireNonEmpty(input.categoryId, "categoryId")
      : existing.category_id;
  requireCategoryOfKind(categoryId, "pending_payment");
  const priority =
    input.priority !== undefined
      ? requirePriority(input.priority)
      : existing.priority;
  const notes =
    input.notes !== undefined ? optionalNotes(input.notes) : existing.notes;

  if (totalAmountCents < existing.paid_cents) {
    throw new DbError(
      "VALIDATION",
      "El monto total no puede ser menor a lo ya pagado",
    );
  }

  const status = statusFromPaid(totalAmountCents, existing.paid_cents);
  const updatedAt = new Date().toISOString();

  getDatabase()
    .prepare(
      `UPDATE pending_payments
       SET description = ?, total_amount_cents = ?, due_on = ?, category_id = ?,
           priority = ?, status = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      description,
      totalAmountCents,
      dueOn,
      categoryId,
      priority,
      status,
      notes,
      updatedAt,
      id,
    );

  const row = getPendingRow(id);
  if (!row) {
    throw new DbError(
      "INTERNAL",
      "No se pudo leer el pago pendiente actualizado",
    );
  }
  return toView(row);
}

export function deletePendingPayment(id: string): { id: string } {
  const existing = getPendingRow(id);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Pago pendiente no encontrado");
  }

  const db = getDatabase();
  const remove = db.transaction(() => {
    const apps = db
      .prepare(
        `SELECT id, expense_id FROM payment_applications
         WHERE pending_payment_id = ?`,
      )
      .all(id) as { id: string; expense_id: string }[];

    db.prepare(
      `DELETE FROM payment_applications WHERE pending_payment_id = ?`,
    ).run(id);

    for (const app of apps) {
      db.prepare(`DELETE FROM expenses WHERE id = ?`).run(app.expense_id);
    }

    db.prepare(`DELETE FROM pending_payments WHERE id = ?`).run(id);
  });

  remove();
  return { id };
}

export function applyPayment(input: {
  pendingPaymentId: string;
  amountCents: number;
  appliedOn: string;
  notes?: string | null;
}): { application: PaymentApplication; expense: Expense } {
  const pendingPaymentId = requireNonEmpty(
    input.pendingPaymentId,
    "pendingPaymentId",
  );
  const amountCents = requirePositiveCents(input.amountCents);
  const appliedOn = requireIsoDate(input.appliedOn, "appliedOn");
  const notes = optionalNotes(input.notes);

  const existing = getPendingRow(pendingPaymentId);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Pago pendiente no encontrado");
  }
  if (existing.status === "paid" || existing.remaining_cents <= 0) {
    throw new DbError("CONFLICT", "Este pago ya está liquidado");
  }
  if (amountCents > existing.remaining_cents) {
    throw new DbError(
      "VALIDATION",
      "El monto supera el restante por liquidar",
    );
  }

  const expenseCategoryId = resolveExpenseCategoryId(existing.category_id);
  const now = new Date().toISOString();
  const applicationId = randomUUID();
  const expenseId = randomUUID();
  const expenseDescription = `Pago: ${existing.description}`;

  const db = getDatabase();
  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO expenses
        (id, description, amount_cents, spent_on, category_id, notes,
         pending_payment_id, payment_application_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      expenseId,
      expenseDescription,
      amountCents,
      appliedOn,
      expenseCategoryId,
      notes,
      pendingPaymentId,
      applicationId,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO payment_applications
        (id, pending_payment_id, amount_cents, applied_on, notes, expense_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      applicationId,
      pendingPaymentId,
      amountCents,
      appliedOn,
      notes,
      expenseId,
      now,
    );

    const paidCents = existing.paid_cents + amountCents;
    const status = statusFromPaid(existing.total_amount_cents, paidCents);
    db.prepare(
      `UPDATE pending_payments SET status = ?, updated_at = ? WHERE id = ?`,
    ).run(status, now, pendingPaymentId);
  });

  run();

  const application = db
    .prepare(
      `SELECT id, pending_payment_id, amount_cents, applied_on, notes,
              expense_id, created_at
       FROM payment_applications WHERE id = ?`,
    )
    .get(applicationId) as ApplicationRow | undefined;
  const expense = db
    .prepare(
      `SELECT id, description, amount_cents, spent_on, category_id, notes,
              pending_payment_id, payment_application_id, created_at, updated_at
       FROM expenses WHERE id = ?`,
    )
    .get(expenseId) as ExpenseRow | undefined;

  if (!application || !expense) {
    throw new DbError("INTERNAL", "No se pudo leer la liquidación creada");
  }

  return {
    application: mapApplication(application),
    expense: mapExpense(expense),
  };
}

export function removeApplication(applicationId: string): { id: string } {
  const id = requireNonEmpty(applicationId, "applicationId");
  const db = getDatabase();
  const app = db
    .prepare(
      `SELECT id, pending_payment_id, expense_id
       FROM payment_applications WHERE id = ?`,
    )
    .get(id) as
    | { id: string; pending_payment_id: string; expense_id: string }
    | undefined;

  if (!app) {
    throw new DbError("NOT_FOUND", "Aplicación de pago no encontrada");
  }

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM payment_applications WHERE id = ?`).run(id);
    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(app.expense_id);
    syncPendingStatus(app.pending_payment_id, now);
  });

  run();
  return { id };
}
