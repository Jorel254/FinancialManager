import { contextBridge, ipcRenderer } from "electron";
import {
  IpcChannels,
  type FinancialManagerApi,
  type IpcResult,
} from "../shared/ipc-contract";
import type {
  Category,
  CategoryKind,
  Expense,
  FinanceSummary,
  HistoryFilters,
  Income,
  PaymentApplication,
  PendingPaymentView,
  UpcomingPaymentItem,
} from "../shared/models";

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>;
}

const api: FinancialManagerApi = {
  categories: {
    list: (kind?: CategoryKind) =>
      invoke<Category[]>(IpcChannels.categoriesList, kind),
  },
  incomes: {
    list: () => invoke<Income[]>(IpcChannels.incomesList),
    create: (input) => invoke<Income>(IpcChannels.incomesCreate, input),
    update: (id, input) =>
      invoke<Income>(IpcChannels.incomesUpdate, id, input),
    delete: (id) => invoke<{ id: string }>(IpcChannels.incomesDelete, id),
  },
  expenses: {
    list: () => invoke<Expense[]>(IpcChannels.expensesList),
    create: (input) => invoke<Expense>(IpcChannels.expensesCreate, input),
    update: (id, input) =>
      invoke<Expense>(IpcChannels.expensesUpdate, id, input),
    delete: (id) => invoke<{ id: string }>(IpcChannels.expensesDelete, id),
  },
  pending: {
    list: () => invoke<PendingPaymentView[]>(IpcChannels.pendingList),
    create: (input) =>
      invoke<PendingPaymentView>(IpcChannels.pendingCreate, input),
    update: (id, input) =>
      invoke<PendingPaymentView>(IpcChannels.pendingUpdate, id, input),
    delete: (id) => invoke<{ id: string }>(IpcChannels.pendingDelete, id),
    applyPayment: (input) =>
      invoke<{ application: PaymentApplication; expense: Expense }>(
        IpcChannels.pendingApplyPayment,
        input,
      ),
    removeApplication: (applicationId) =>
      invoke<{ id: string }>(
        IpcChannels.pendingRemoveApplication,
        applicationId,
      ),
  },
  finance: {
    summary: (month: string) =>
      invoke<{ summary: FinanceSummary; upcoming: UpcomingPaymentItem[] }>(
        IpcChannels.financeSummary,
        month,
      ),
  },
  history: {
    query: (filters: HistoryFilters) =>
      invoke<unknown[]>(IpcChannels.historyQuery, filters),
  },
};

contextBridge.exposeInMainWorld("api", api);
