import { assertPositiveCents } from "../../shared/money";
import type { CategoryKind } from "../../shared/models";
import { DbError } from "./errors";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DbError("VALIDATION", `${field} es requerido`);
  }
  return value.trim();
}

export function requireIsoDate(value: unknown, field: string): string {
  const text = requireNonEmpty(value, field);
  if (!ISO_DATE.test(text)) {
    throw new DbError("VALIDATION", `${field} debe ser YYYY-MM-DD`);
  }
  const [y, m, d] = text.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new DbError("VALIDATION", `${field} no es una fecha válida`);
  }
  return text;
}

export function requireIsoMonth(value: unknown): string {
  if (typeof value !== "string" || !ISO_MONTH.test(value)) {
    throw new DbError("VALIDATION", "month debe ser YYYY-MM");
  }
  const [y, m] = value.split("-").map(Number);
  if (m < 1 || m > 12) {
    throw new DbError("VALIDATION", "month inválido");
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

export function requirePositiveCents(value: unknown, field = "amountCents"): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new DbError("VALIDATION", `${field} debe ser un entero en centavos`);
  }
  try {
    assertPositiveCents(value);
  } catch {
    throw new DbError("VALIDATION", `${field} debe ser mayor a 0`);
  }
  return value;
}

export function optionalNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new DbError("VALIDATION", "notes debe ser texto");
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function requireCategoryKind(value: unknown): CategoryKind | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    value === "income" ||
    value === "expense" ||
    value === "pending_payment"
  ) {
    return value;
  }
  throw new DbError("VALIDATION", "kind de categoría inválido");
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function todayLocalIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
