# Electron (main + preload)

- `main.ts` — BrowserWindow, abre SQLite en `userData`, `contextIsolation: true`, `nodeIntegration: false`
- `preload.ts` — `contextBridge` → `window.api`
- `ipc/register-handlers.ts` — categorías, incomes/expenses CRUD y finance summary reales; pendientes/historial stub
- `db/` — `better-sqlite3`, migraciones y repositorios
