import type {
  HistoryFilters,
  HistoryItem,
  HistoryItemType,
  PendingPaymentStatus,
} from "../../../shared/models";
import { getDatabase } from "../connection";
import { DbError } from "../errors";
import { requireIsoDate } from "../validation";

const HISTORY_TYPES: HistoryItemType[] = [
  "income",
  "expense",
  "pending",
  "application",
];

interface HistoryRow {
  id: string;
  type: HistoryItemType;
  description: string;
  amount_cents: number;
  date: string;
  category_id: string;
  category_name: string;
  notes: string | null;
  status: PendingPaymentStatus | null;
  remaining_cents: number | null;
  pending_payment_id: string | null;
  created_at: string;
}

function requireHistoryType(value: unknown): HistoryItemType | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value === "string" &&
    (HISTORY_TYPES as string[]).includes(value)
  ) {
    return value as HistoryItemType;
  }
  throw new DbError("VALIDATION", "type de historial inválido");
}

function optionalIsoDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireIsoDate(value, field);
}

function optionalTrimmed(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new DbError("VALIDATION", "query debe ser texto");
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function mapHistoryItem(row: HistoryRow): HistoryItem {
  const item: HistoryItem = {
    id: row.id,
    type: row.type,
    description: row.description,
    amountCents: row.amount_cents,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    notes: row.notes,
    pendingPaymentId: row.pending_payment_id,
    createdAt: row.created_at,
  };
  if (row.type === "pending") {
    item.status = row.status ?? undefined;
    item.remainingCents = row.remaining_cents ?? undefined;
  }
  return item;
}

/**
 * Consulta unificada de movimientos: ingresos, egresos,
 * pagos pendientes y liquidaciones (applications).
 */
export function queryHistory(filtersInput: HistoryFilters = {}): HistoryItem[] {
  const type = requireHistoryType(filtersInput.type);
  const from = optionalIsoDate(filtersInput.from, "from");
  const to = optionalIsoDate(filtersInput.to, "to");
  if (from && to && from > to) {
    throw new DbError("VALIDATION", "from no puede ser posterior a to");
  }

  const categoryId =
    typeof filtersInput.categoryId === "string" &&
    filtersInput.categoryId.trim().length > 0
      ? filtersInput.categoryId.trim()
      : undefined;

  const query = optionalTrimmed(filtersInput.query);

  const where: string[] = [];
  const params: unknown[] = [];

  if (type) {
    where.push("h.type = ?");
    params.push(type);
  }
  if (categoryId) {
    where.push("h.category_id = ?");
    params.push(categoryId);
  }
  if (from) {
    where.push("h.date >= ?");
    params.push(from);
  }
  if (to) {
    where.push("h.date <= ?");
    params.push(to);
  }
  if (query) {
    where.push("h.description LIKE ? COLLATE NOCASE");
    params.push(`%${query}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      h.id,
      h.type,
      h.description,
      h.amount_cents,
      h.date,
      h.category_id,
      c.name AS category_name,
      h.notes,
      h.status,
      h.remaining_cents,
      h.pending_payment_id,
      h.created_at
    FROM (
      SELECT
        i.id AS id,
        'income' AS type,
        i.description AS description,
        i.amount_cents AS amount_cents,
        i.received_on AS date,
        i.category_id AS category_id,
        i.notes AS notes,
        CAST(NULL AS TEXT) AS status,
        CAST(NULL AS INTEGER) AS remaining_cents,
        CAST(NULL AS TEXT) AS pending_payment_id,
        i.created_at AS created_at
      FROM incomes i

      UNION ALL

      SELECT
        e.id,
        'expense',
        e.description,
        e.amount_cents,
        e.spent_on,
        e.category_id,
        e.notes,
        NULL,
        NULL,
        e.pending_payment_id,
        e.created_at
      FROM expenses e

      UNION ALL

      SELECT
        pp.id,
        'pending',
        pp.description,
        pp.total_amount_cents,
        pp.due_on,
        pp.category_id,
        pp.notes,
        pp.status,
        (pp.total_amount_cents - COALESCE(paid.paid_cents, 0)),
        pp.id,
        pp.created_at
      FROM pending_payments pp
      LEFT JOIN (
        SELECT pending_payment_id, SUM(amount_cents) AS paid_cents
        FROM payment_applications
        GROUP BY pending_payment_id
      ) paid ON paid.pending_payment_id = pp.id

      UNION ALL

      SELECT
        pa.id,
        'application',
        pp.description,
        pa.amount_cents,
        pa.applied_on,
        pp.category_id,
        pa.notes,
        NULL,
        NULL,
        pa.pending_payment_id,
        pa.created_at
      FROM payment_applications pa
      INNER JOIN pending_payments pp ON pp.id = pa.pending_payment_id
    ) h
    INNER JOIN categories c ON c.id = h.category_id
    ${whereSql}
    ORDER BY h.date DESC, h.created_at DESC, h.id DESC
  `;

  const rows = getDatabase().prepare(sql).all(...params) as HistoryRow[];
  return rows.map(mapHistoryItem);
}
