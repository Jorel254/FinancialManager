# Electron (main + preload)

- `main.ts` — BrowserWindow, abre SQLite en `userData`, `contextIsolation: true`, `nodeIntegration: false`
- `preload.ts` — `contextBridge` → `window.api`
- `ipc/register-handlers.ts` — handlers IPC (CRUD, finance, historial, settings)
- `db/` — `better-sqlite3`, migraciones y repositorios

## Persistencia

La DB se abre con `app.getPath("userData")` → `%APPDATA%\financialmanager\financial-manager.sqlite`.
Nunca se escribe dentro de la carpeta de instalación (`release/win-unpacked` o Programs).

## Empaquetado

Ver `electron-builder.yml` y la sección «Instalador Windows» del README raíz (`npm run dist` / `npm run package`).
