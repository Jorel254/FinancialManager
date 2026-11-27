# Electron (main + preload)

- `main.ts` — BrowserWindow, `contextIsolation: true`, `nodeIntegration: false`
- `preload.ts` — `contextBridge` → `window.api`
- `ipc/register-handlers.ts` — stubs hasta Etapa 3 (SQLite)
