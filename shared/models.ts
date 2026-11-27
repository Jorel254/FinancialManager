/**
 * Modelos de dominio — FinancialManager (Etapa 1).
 * Fuente de verdad de tipos compartidos entre main y renderer.
 * Montos siempre en centavos enteros.
 */

export type CategoryKind = "income" | "expense" | "pending_payment";

export type PendingPaymentStatus = "pending" | "partial" | "paid";

/** Prioridad manual: 1 = alta, 2 = media, 3 = baja */
export type PaymentPriority = 1 | 2 | 3;

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  isDefault: boolean;
  createdAt: string;
}

export interface Income {
  id: string;
  description: string;
  amountCents: number;
  receivedOn: string; // YYYY-MM-DD
  categoryId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  spentOn: string; // YYYY-MM-DD
  categoryId: string;
  notes: string | null;
  /** Si el egreso nace de liquidar un pendiente */
  pendingPaymentId: string | null;
  paymentApplicationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingPayment {
  id: string;
  description: string;
  totalAmountCents: number;
  dueOn: string; // YYYY-MM-DD
  categoryId: string;
  priority: PaymentPriority;
  status: PendingPaymentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentApplication {
  id: string;
  pendingPaymentId: string;
  amountCents: number;
  appliedOn: string; // YYYY-MM-DD
  notes: string | null;
  expenseId: string;
  createdAt: string;
}

/** Campos derivados al leer pendientes */
export interface PendingPaymentView extends PendingPayment {
  paidCents: number;
  remainingCents: number;
  applications: PaymentApplication[];
}

/** Resumen del dashboard para un mes YYYY-MM */
export interface FinanceSummary {
  month: string;
  availableBalanceCents: number;
  incomeMonthCents: number;
  expenseMonthCents: number;
  committedMonthCents: number;
  projectedBalanceCents: number;
}

/** Preferencias de la app (persistidas en SQLite) */
export interface AppSettings {
  /** Si true, oculta montos de ingresos y saldo disponible en la UI */
  hideAmounts: boolean;
}

export type DueUrgency =
  | "overdue"
  | "today"
  | "within_3_days"
  | "within_7_days"
  | "later";

export interface UpcomingPaymentItem extends PendingPaymentView {
  urgency: DueUrgency;
}

/** Tipos unificados del historial (filtro + filas) */
export type HistoryItemType =
  | "income"
  | "expense"
  | "pending"
  | "application";

export interface HistoryFilters {
  type?: HistoryItemType;
  categoryId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  query?: string;
}

/** Fila unificada para la sección Historial */
export interface HistoryItem {
  id: string;
  type: HistoryItemType;
  description: string;
  amountCents: number;
  /** Fecha relevante: recepción / gasto / vencimiento / aplicación */
  date: string;
  categoryId: string;
  categoryName: string;
  notes: string | null;
  /** Solo type=pending */
  status?: PendingPaymentStatus;
  /** Solo type=pending */
  remainingCents?: number;
  /** type=expense ligado a liquidación, o type=application */
  pendingPaymentId?: string | null;
  createdAt: string;
}
