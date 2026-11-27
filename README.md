# FinancialManager

Aplicación de escritorio (Windows) para finanzas personales: ingresos, egresos, pagos pendientes y dashboard local.

**Stack objetivo:** React · Electron · Vite · TypeScript · SQLite · shadcn/ui · Tailwind

## Estado

**Etapa 1 completada (arquitectura):** modelos, reglas de negocio, contrato IPC y estructura de carpetas documentados/esbozados.

El scaffold `app/` + React Router SSR es **temporal** (create-react-router). En **Etapa 2** se reemplaza por Electron + Vite SPA usando `electron/`, `src/` y `shared/`.

## Estructura objetivo

```
electron/     # main, preload, IPC, SQLite
shared/       # modelos, dinero (centavos), contrato IPC
src/          # renderer React + shadcn
resources/    # iconos / empaquetado
```

## Desarrollo

Scripts actuales del scaffold web (`npm run dev`) no son el runtime final de escritorio. Etapa 2 definirá `dev`/`build` de Electron.

## Documentación

La arquitectura de Etapa 1 vive en el Project store del equipo (`docs/etapa-1-arquitectura.md`).
