/**
 * Contrato IPC — canales y forma de respuesta.
 * Preload expone window.api; handlers SQLite reales desde Etapa 3.
 */

import type {
  Category,
  CategoryKind,
  Expense,
  FinanceSummary,
  HistoryFilters,
  Income,
  PaymentApplication,
  PendingPayment,
  PendingPaymentView,
  UpcomingPaymentItem,
} from "./models";

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export const IpcChannels = {
  categoriesList: "fm:categories:list",
  incomesList: "fm:incomes:list",
  incomesCreate: "fm:incomes:create",
  incomesUpdate: "fm:incomes:update",
  incomesDelete: "fm:incomes:delete",
  expensesList: "fm:expenses:list",
  expensesCreate: "fm:expenses:create",
  expensesUpdate: "fm:expenses:update",
  expensesDelete: "fm:expenses:delete",
  pendingList: "fm:pending:list",
  pendingCreate: "fm:pending:create",
  pendingUpdate: "fm:pending:update",
  pendingDelete: "fm:pending:delete",
  pendingApplyPayment: "fm:pending:applyPayment",
  pendingRemoveApplication: "fm:pending:removeApplication",
  financeSummary: "fm:finance:summary",
  historyQuery: "fm:history:query",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** API que expondrá el preload como window.api */
export interface FinancialManagerApi {
  categories: {
    list: (kind?: CategoryKind) => Promise<IpcResult<Category[]>>;
  };
  incomes: {
    list: () => Promise<IpcResult<Income[]>>;
    create: (
      input: Omit<Income, "id" | "createdAt" | "updatedAt">,
    ) => Promise<IpcResult<Income>>;
    update: (
      id: string,
      input: Partial<Omit<Income, "id" | "createdAt" | "updatedAt">>,
    ) => Promise<IpcResult<Income>>;
    delete: (id: string) => Promise<IpcResult<{ id: string }>>;
  };
  expenses: {
    list: () => Promise<IpcResult<Expense[]>>;
    create: (
      input: Omit<
        Expense,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "pendingPaymentId"
        | "paymentApplicationId"
      >,
    ) => Promise<IpcResult<Expense>>;
    update: (
      id: string,
      input: Partial<
        Omit<
          Expense,
          | "id"
          | "createdAt"
          | "updatedAt"
          | "pendingPaymentId"
          | "paymentApplicationId"
        >
      >,
    ) => Promise<IpcResult<Expense>>;
    delete: (id: string) => Promise<IpcResult<{ id: string }>>;
  };
  pending: {
    list: () => Promise<IpcResult<PendingPaymentView[]>>;
    create: (
      input: Omit<PendingPayment, "id" | "status" | "createdAt" | "updatedAt">,
    ) => Promise<IpcResult<PendingPaymentView>>;
    update: (
      id: string,
      input: Partial<
        Omit<PendingPayment, "id" | "status" | "createdAt" | "updatedAt">
      >,
    ) => Promise<IpcResult<PendingPaymentView>>;
    delete: (id: string) => Promise<IpcResult<{ id: string }>>;
    applyPayment: (input: {
      pendingPaymentId: string;
      amountCents: number;
      appliedOn: string;
      notes?: string | null;
    }) => Promise<
      IpcResult<{ application: PaymentApplication; expense: Expense }>
    >;
    removeApplication: (
      applicationId: string,
    ) => Promise<IpcResult<{ id: string }>>;
  };
  finance: {
    summary: (
      month: string,
    ) => Promise<
      IpcResult<{ summary: FinanceSummary; upcoming: UpcomingPaymentItem[] }>
    >;
  };
  history: {
    query: (filters: HistoryFilters) => Promise<IpcResult<unknown[]>>;
  };
}

declare global {
  interface Window {
    api?: FinancialManagerApi;
  }
}

export {};
