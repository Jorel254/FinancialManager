import { ipcMain } from "electron";
import { IpcChannels, type IpcResult } from "../../shared/ipc-contract";
import type { FinanceSummary, UpcomingPaymentItem } from "../../shared/models";

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function notImplemented<T>(): IpcResult<T> {
  return {
    ok: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Persistencia SQLite pendiente (Etapa 3)",
    },
  };
}

function emptySummary(month: string): FinanceSummary {
  return {
    month,
    availableBalanceCents: 0,
    incomeMonthCents: 0,
    expenseMonthCents: 0,
    committedMonthCents: 0,
    projectedBalanceCents: 0,
  };
}

/**
 * Stubs IPC — Etapa 2.
 * Lecturas vacías OK; mutaciones → NOT_IMPLEMENTED hasta Etapa 3.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.categoriesList, () => ok([]));
  ipcMain.handle(IpcChannels.incomesList, () => ok([]));
  ipcMain.handle(IpcChannels.incomesCreate, () => notImplemented());
  ipcMain.handle(IpcChannels.incomesUpdate, () => notImplemented());
  ipcMain.handle(IpcChannels.incomesDelete, () => notImplemented());
  ipcMain.handle(IpcChannels.expensesList, () => ok([]));
  ipcMain.handle(IpcChannels.expensesCreate, () => notImplemented());
  ipcMain.handle(IpcChannels.expensesUpdate, () => notImplemented());
  ipcMain.handle(IpcChannels.expensesDelete, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingList, () => ok([]));
  ipcMain.handle(IpcChannels.pendingCreate, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingUpdate, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingDelete, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingApplyPayment, () => notImplemented());
  ipcMain.handle(IpcChannels.pendingRemoveApplication, () => notImplemented());
  ipcMain.handle(IpcChannels.financeSummary, (_e, month: string) =>
    ok<{ summary: FinanceSummary; upcoming: UpcomingPaymentItem[] }>({
      summary: emptySummary(
        typeof month === "string" && month.length > 0 ? month : "0000-00",
      ),
      upcoming: [],
    }),
  );
  ipcMain.handle(IpcChannels.historyQuery, () => ok([]));
}
