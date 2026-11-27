import { randomUUID } from "node:crypto";
import type { Expense } from "../../../shared/models";
import { getDatabase } from "../connection";
import { DbError } from "../errors";
import {
  optionalNotes,
  requireIsoDate,
  requireNonEmpty,
  requirePositiveCents,
} from "../validation";
import { requireCategoryOfKind } from "./categories";

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

type ExpenseCreateInput = Omit<
  Expense,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "pendingPaymentId"
  | "paymentApplicationId"
>;
type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

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

function getExpenseRow(id: string): ExpenseRow | undefined {
  return getDatabase()
    .prepare(
      `SELECT id, description, amount_cents, spent_on, category_id, notes,
              pending_payment_id, payment_application_id, created_at, updated_at
       FROM expenses WHERE id = ?`,
    )
    .get(id) as ExpenseRow | undefined;
}

export function listExpenses(): Expense[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, description, amount_cents, spent_on, category_id, notes,
              pending_payment_id, payment_application_id, created_at, updated_at
       FROM expenses
       ORDER BY spent_on DESC, created_at DESC`,
    )
    .all() as ExpenseRow[];
  return rows.map(mapExpense);
}

export function createExpense(input: ExpenseCreateInput): Expense {
  const description = requireNonEmpty(input.description, "description");
  const amountCents = requirePositiveCents(input.amountCents);
  const spentOn = requireIsoDate(input.spentOn, "spentOn");
  const categoryId = requireNonEmpty(input.categoryId, "categoryId");
  requireCategoryOfKind(categoryId, "expense");
  const notes = optionalNotes(input.notes);

  const now = new Date().toISOString();
  const id = randomUUID();

  getDatabase()
    .prepare(
      `INSERT INTO expenses
        (id, description, amount_cents, spent_on, category_id, notes,
         pending_payment_id, payment_application_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .run(id, description, amountCents, spentOn, categoryId, notes, now, now);

  const row = getExpenseRow(id);
  if (!row) throw new DbError("INTERNAL", "No se pudo leer el egreso creado");
  return mapExpense(row);
}

export function updateExpense(id: string, input: ExpenseUpdateInput): Expense {
  const existing = getExpenseRow(id);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Egreso no encontrado");
  }
  if (existing.payment_application_id) {
    throw new DbError(
      "CONFLICT",
      "No se puede editar un egreso ligado a un pago pendiente; usa la aplicación de pago",
    );
  }

  const description =
    input.description !== undefined
      ? requireNonEmpty(input.description, "description")
      : existing.description;
  const amountCents =
    input.amountCents !== undefined
      ? requirePositiveCents(input.amountCents)
      : existing.amount_cents;
  const spentOn =
    input.spentOn !== undefined
      ? requireIsoDate(input.spentOn, "spentOn")
      : existing.spent_on;
  const categoryId =
    input.categoryId !== undefined
      ? requireNonEmpty(input.categoryId, "categoryId")
      : existing.category_id;
  requireCategoryOfKind(categoryId, "expense");
  const notes =
    input.notes !== undefined ? optionalNotes(input.notes) : existing.notes;
  const updatedAt = new Date().toISOString();

  getDatabase()
    .prepare(
      `UPDATE expenses
       SET description = ?, amount_cents = ?, spent_on = ?, category_id = ?,
           notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(description, amountCents, spentOn, categoryId, notes, updatedAt, id);

  const row = getExpenseRow(id);
  if (!row) throw new DbError("INTERNAL", "No se pudo leer el egreso actualizado");
  return mapExpense(row);
}

export function deleteExpense(id: string): { id: string } {
  const existing = getExpenseRow(id);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Egreso no encontrado");
  }
  if (existing.payment_application_id) {
    throw new DbError(
      "CONFLICT",
      "No se puede eliminar un egreso ligado a un pago pendiente; deshaz la aplicación",
    );
  }

  getDatabase().prepare("DELETE FROM expenses WHERE id = ?").run(id);
  return { id };
}
