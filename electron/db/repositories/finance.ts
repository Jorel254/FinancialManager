import type {
  FinanceSummary,
  PaymentPriority,
  PendingPaymentStatus,
  UpcomingPaymentItem,
} from "../../../shared/models";
import { urgencyFor, urgencyRank } from "../../../shared/due";
import { getDatabase } from "../connection";
import {
  monthBounds,
  requireIsoMonth,
  todayLocalIsoDate,
} from "../validation";

interface SumRow {
  total: number | null;
}

interface UpcomingRow {
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

function sumCents(sql: string, params: unknown[] = []): number {
  const row = getDatabase().prepare(sql).get(...params) as SumRow;
  return row.total ?? 0;
}

function listApplicationsFor(pendingId: string) {
  const rows = getDatabase()
    .prepare(
      `SELECT id, pending_payment_id, amount_cents, applied_on, notes,
              expense_id, created_at
       FROM payment_applications
       WHERE pending_payment_id = ?
       ORDER BY applied_on ASC, created_at ASC`,
    )
    .all(pendingId) as ApplicationRow[];

  return rows.map((row) => ({
    id: row.id,
    pendingPaymentId: row.pending_payment_id,
    amountCents: row.amount_cents,
    appliedOn: row.applied_on,
    notes: row.notes,
    expenseId: row.expense_id,
    createdAt: row.created_at,
  }));
}

export function getFinanceSummary(monthInput: string): {
  summary: FinanceSummary;
  upcoming: UpcomingPaymentItem[];
} {
  const month = requireIsoMonth(monthInput);
  const { from, to } = monthBounds(month);
  const db = getDatabase();

  const availableBalanceCents =
    sumCents("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM incomes") -
    sumCents("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses");

  const incomeMonthCents = sumCents(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
     FROM incomes WHERE received_on >= ? AND received_on <= ?`,
    [from, to],
  );

  const expenseMonthCents = sumCents(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
     FROM expenses WHERE spent_on >= ? AND spent_on <= ?`,
    [from, to],
  );

  const committedMonthCents = sumCents(
    `SELECT COALESCE(SUM(
        pp.total_amount_cents - COALESCE(paid.paid_cents, 0)
      ), 0) AS total
     FROM pending_payments pp
     LEFT JOIN (
       SELECT pending_payment_id, SUM(amount_cents) AS paid_cents
       FROM payment_applications
       GROUP BY pending_payment_id
     ) paid ON paid.pending_payment_id = pp.id
     WHERE pp.due_on >= ? AND pp.due_on <= ?
       AND pp.status IN ('pending', 'partial')`,
    [from, to],
  );

  const summary: FinanceSummary = {
    month,
    availableBalanceCents,
    incomeMonthCents,
    expenseMonthCents,
    committedMonthCents,
    projectedBalanceCents: availableBalanceCents - committedMonthCents,
  };

  const rows = db
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
       WHERE pp.status IN ('pending', 'partial')
       ORDER BY pp.due_on ASC, pp.priority ASC, pp.created_at ASC`,
    )
    .all() as UpcomingRow[];

  const today = todayLocalIsoDate();
  const upcoming: UpcomingPaymentItem[] = rows
    .map((row) => {
      const urgency = urgencyFor(row.due_on, today);
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
        urgency,
      };
    })
    .sort((a, b) => {
      const urg = urgencyRank(a.urgency) - urgencyRank(b.urgency);
      if (urg !== 0) return urg;
      if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt < b.createdAt ? -1 : 1;
    });

  return { summary, upcoming };
}
