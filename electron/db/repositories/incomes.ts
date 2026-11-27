import { randomUUID } from "node:crypto";
import type { Income } from "../../../shared/models";
import { getDatabase } from "../connection";
import { DbError } from "../errors";
import {
  optionalNotes,
  requireIsoDate,
  requireNonEmpty,
  requirePositiveCents,
} from "../validation";
import { requireCategoryOfKind } from "./categories";

interface IncomeRow {
  id: string;
  description: string;
  amount_cents: number;
  received_on: string;
  category_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type IncomeCreateInput = Omit<Income, "id" | "createdAt" | "updatedAt">;
type IncomeUpdateInput = Partial<IncomeCreateInput>;

function mapIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    receivedOn: row.received_on,
    categoryId: row.category_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getIncomeRow(id: string): IncomeRow | undefined {
  return getDatabase()
    .prepare(
      `SELECT id, description, amount_cents, received_on, category_id, notes,
              created_at, updated_at
       FROM incomes WHERE id = ?`,
    )
    .get(id) as IncomeRow | undefined;
}

export function listIncomes(): Income[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, description, amount_cents, received_on, category_id, notes,
              created_at, updated_at
       FROM incomes
       ORDER BY received_on DESC, created_at DESC`,
    )
    .all() as IncomeRow[];
  return rows.map(mapIncome);
}

export function createIncome(input: IncomeCreateInput): Income {
  const description = requireNonEmpty(input.description, "description");
  const amountCents = requirePositiveCents(input.amountCents);
  const receivedOn = requireIsoDate(input.receivedOn, "receivedOn");
  const categoryId = requireNonEmpty(input.categoryId, "categoryId");
  requireCategoryOfKind(categoryId, "income");
  const notes = optionalNotes(input.notes);

  const now = new Date().toISOString();
  const id = randomUUID();

  getDatabase()
    .prepare(
      `INSERT INTO incomes
        (id, description, amount_cents, received_on, category_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, description, amountCents, receivedOn, categoryId, notes, now, now);

  const row = getIncomeRow(id);
  if (!row) throw new DbError("INTERNAL", "No se pudo leer el ingreso creado");
  return mapIncome(row);
}

export function updateIncome(id: string, input: IncomeUpdateInput): Income {
  const existing = getIncomeRow(id);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Ingreso no encontrado");
  }

  const description =
    input.description !== undefined
      ? requireNonEmpty(input.description, "description")
      : existing.description;
  const amountCents =
    input.amountCents !== undefined
      ? requirePositiveCents(input.amountCents)
      : existing.amount_cents;
  const receivedOn =
    input.receivedOn !== undefined
      ? requireIsoDate(input.receivedOn, "receivedOn")
      : existing.received_on;
  const categoryId =
    input.categoryId !== undefined
      ? requireNonEmpty(input.categoryId, "categoryId")
      : existing.category_id;
  requireCategoryOfKind(categoryId, "income");
  const notes =
    input.notes !== undefined ? optionalNotes(input.notes) : existing.notes;
  const updatedAt = new Date().toISOString();

  getDatabase()
    .prepare(
      `UPDATE incomes
       SET description = ?, amount_cents = ?, received_on = ?, category_id = ?,
           notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      description,
      amountCents,
      receivedOn,
      categoryId,
      notes,
      updatedAt,
      id,
    );

  const row = getIncomeRow(id);
  if (!row) throw new DbError("INTERNAL", "No se pudo leer el ingreso actualizado");
  return mapIncome(row);
}

export function deleteIncome(id: string): { id: string } {
  const result = getDatabase()
    .prepare("DELETE FROM incomes WHERE id = ?")
    .run(id);
  if (result.changes === 0) {
    throw new DbError("NOT_FOUND", "Ingreso no encontrado");
  }
  return { id };
}
