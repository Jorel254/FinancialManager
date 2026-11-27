import { ipcMain } from "electron";
import { IpcChannels, type IpcResult } from "../../shared/ipc-contract";
import type { HistoryFilters } from "../../shared/models";
import { isDbError } from "../db/errors";
import { listCategories } from "../db/repositories/categories";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "../db/repositories/expenses";
import { getFinanceSummary } from "../db/repositories/finance";
import { queryHistory } from "../db/repositories/history";
import {
  createIncome,
  deleteIncome,
  listIncomes,
  updateIncome,
} from "../db/repositories/incomes";
import {
  applyPayment,
  createPendingPayment,
  deletePendingPayment,
  listPendingPayments,
  removeApplication,
  updatePendingPayment,
} from "../db/repositories/pending-payments";

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): IpcResult<T> {
  return { ok: false, error: { code, message } };
}

function wrap<T>(fn: () => T): IpcResult<T> {
  try {
    return ok(fn());
  } catch (error) {
    if (isDbError(error)) {
      return fail(error.code, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Error interno inesperado";
    return fail("INTERNAL", message);
  }
}

/**
 * Handlers IPC — Etapa 7.
 * Reales: categorías, incomes, expenses, pending, finance, history.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.categoriesList, (_e, kind) =>
    wrap(() => listCategories(kind)),
  );

  ipcMain.handle(IpcChannels.incomesList, () => wrap(() => listIncomes()));
  ipcMain.handle(IpcChannels.incomesCreate, (_e, input) =>
    wrap(() => createIncome(input)),
  );
  ipcMain.handle(IpcChannels.incomesUpdate, (_e, id, input) =>
    wrap(() => updateIncome(id, input)),
  );
  ipcMain.handle(IpcChannels.incomesDelete, (_e, id) =>
    wrap(() => deleteIncome(id)),
  );

  ipcMain.handle(IpcChannels.expensesList, () => wrap(() => listExpenses()));
  ipcMain.handle(IpcChannels.expensesCreate, (_e, input) =>
    wrap(() => createExpense(input)),
  );
  ipcMain.handle(IpcChannels.expensesUpdate, (_e, id, input) =>
    wrap(() => updateExpense(id, input)),
  );
  ipcMain.handle(IpcChannels.expensesDelete, (_e, id) =>
    wrap(() => deleteExpense(id)),
  );

  ipcMain.handle(IpcChannels.pendingList, () =>
    wrap(() => listPendingPayments()),
  );
  ipcMain.handle(IpcChannels.pendingCreate, (_e, input) =>
    wrap(() => createPendingPayment(input)),
  );
  ipcMain.handle(IpcChannels.pendingUpdate, (_e, id, input) =>
    wrap(() => updatePendingPayment(id, input)),
  );
  ipcMain.handle(IpcChannels.pendingDelete, (_e, id) =>
    wrap(() => deletePendingPayment(id)),
  );
  ipcMain.handle(IpcChannels.pendingApplyPayment, (_e, input) =>
    wrap(() => applyPayment(input)),
  );
  ipcMain.handle(IpcChannels.pendingRemoveApplication, (_e, applicationId) =>
    wrap(() => removeApplication(applicationId)),
  );

  ipcMain.handle(IpcChannels.financeSummary, (_e, month: string) =>
    wrap(() => getFinanceSummary(month)),
  );

  ipcMain.handle(IpcChannels.historyQuery, (_e, filters?: HistoryFilters) =>
    wrap(() => queryHistory(filters ?? {})),
  );
}
