import { ipcMain } from "electron";
import { IpcChannels, type IpcResult } from "../../shared/ipc-contract";
import { isDbError } from "../db/errors";
import { listCategories } from "../db/repositories/categories";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "../db/repositories/expenses";
import { getFinanceSummary } from "../db/repositories/finance";
import {
  createIncome,
  deleteIncome,
  listIncomes,
  updateIncome,
} from "../db/repositories/incomes";

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): IpcResult<T> {
  return { ok: false, error: { code, message } };
}

function notImplemented<T>(): IpcResult<T> {
  return fail(
    "NOT_IMPLEMENTED",
    "Pagos pendientes e historial llegan en Etapas 4–5 / 7",
  );
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
 * Handlers IPC — Etapa 3.
 * Reales: categorías, incomes CRUD, expenses CRUD, finance summary.
 * Pendientes/historial: stub hasta etapas posteriores.
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

  ipcMain.handle(IpcChannels.pendingList, () => ok([]));
  ipcMain.handle(IpcChannels.pendingCreate, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingUpdate, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingDelete, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingApplyPayment, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingRemoveApplication, () => notImplemented());

  ipcMain.handle(IpcChannels.financeSummary, (_e, month: string) =>
    wrap(() => getFinanceSummary(month)),
  );

  ipcMain.handle(IpcChannels.historyQuery, () => notImplemented());
}
