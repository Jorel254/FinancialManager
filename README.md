# FinancialManager

Aplicación de escritorio (Windows) para finanzas personales: ingresos, egresos, pagos pendientes y dashboard local.

**Stack:** React · Electron · Vite · TypeScript · SQLite (Etapa 3+) · shadcn/ui · Tailwind

## Estado

**Etapa 2 lista:** Electron + Vite SPA, preload `window.api`, Tailwind + base shadcn, ventana de escritorio con shell UI.

## Cómo correr (Windows)

```powershell
cd C:\Users\gonza\Escritorio\Github\FinancialManager
npm install
npm run dev
```

Otros scripts:

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Dev server Vite + ventana Electron |
| `npm run build` | Compila main/preload/renderer a `out/` |
| `npm run preview` | Previsualiza el build de producción |
| `npm run typecheck` | TypeScript (node + web) |

## Estructura

```
electron/     # main, preload, IPC (stubs)
shared/       # modelos, dinero, contrato IPC
src/          # renderer React + shadcn
resources/    # assets de empaquetado (Etapa 9)
```

## Seguridad Electron

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- UI solo habla con `window.api` (preload)

## Siguiente

**Etapa 3:** SQLite (`better-sqlite3`), migraciones y repositorios reales detrás de los handlers IPC.
