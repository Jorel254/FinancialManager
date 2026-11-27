# electron/

Proceso **main** y **preload** de Electron.

| Archivo / carpeta | Rol | Etapa |
|-------------------|-----|-------|
| `main.ts` | Entry, BrowserWindow, ciclo de vida | 2 |
| `preload.ts` | `contextBridge` → `window.api` | 2 |
| `ipc/` | Registro de handlers IPC | 2–3 |
| `db/` | SQLite (`better-sqlite3`), migraciones, repos | 3 |

No implementar aquí la app completa en Etapa 1: solo estructura.
