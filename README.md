# FinancialManager

Aplicación de escritorio (Windows) para finanzas personales: ingresos, egresos, pagos pendientes y dashboard local.

**Stack:** React · Electron · Vite · TypeScript · SQLite · shadcn/ui · Tailwind · electron-builder

## Estado

**Etapa 9 lista:** instalador Windows NSIS (`.exe`) con `electron-builder`. La app empaquetada no requiere Node.js en el PC destino. SQLite permanece en `userData`.

## Cómo correr (desarrollo)

```powershell
cd C:\Users\gonza\Escritorio\Github\FinancialManager
npm install
npm run dev
```

## Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Dev server Vite + ventana Electron |
| `npm run build` | Compila main/preload/renderer a `out/` |
| `npm run preview` | Previsualiza el build de producción (sin instalador) |
| `npm run package` | Build + carpeta empaquetada en `release/win-unpacked/` (sin `.exe` de setup) |
| `npm run dist` | Build + instalador NSIS en `release/` |
| `npm run typecheck` | TypeScript (node + web) |
| `npm run smoke` | Smokes de DB / pagos / historial / etapa 8 / settings |

## Instalador Windows (Etapa 9)

### Generar

```powershell
npm run dist
```

Salida típica:

```
release/
  FinancialManager-0.1.0-win-x64-setup.exe   ← instalador
  win-unpacked/                              ← app descomprimida (también con npm run package)
```

Configuración: `electron-builder.yml`.

### Probar el instalador

1. Ejecuta `npm run dist` en esta máquina de desarrollo (sí necesita Node.js / build tools).
2. Copia `release\FinancialManager-*-win-x64-setup.exe` a un PC Windows de prueba **sin** Node.js (o al mismo PC).
3. Ejecuta el `.exe`. Elige carpeta de instalación si quieres (NSIS permite cambiarla).
4. Abre FinancialManager desde el acceso directo; registra un ingreso de prueba y cierra la app.
5. Vuelve a abrir: los datos deben seguir ahí.
6. Comprueba la DB fuera de la carpeta de instalación:

```
%APPDATA%\financialmanager\financial-manager.sqlite
```

(Equivale a `C:\Users\<usuario>\AppData\Roaming\financialmanager\...`.)

7. Opcional sin instalar: `npm run package` y ejecuta `release\win-unpacked\FinancialManager.exe`.

### Persistencia vs instalación

| Qué | Dónde |
|-----|--------|
| Binarios de la app | Carpeta elegida al instalar (p. ej. `%LOCALAPPDATA%\Programs\FinancialManager`) |
| Base SQLite | `%APPDATA%\financialmanager\financial-manager.sqlite` (`app.getPath("userData")`) |

Al desinstalar, **no** se borra `userData` (`deleteAppDataOnUninstall: false`), para no perder el historial financiero.

> La v1 no firma el ejecutable: Windows SmartScreen puede mostrar una advertencia la primera vez.

## Estructura

```
electron/              # main, preload, IPC, SQLite
shared/                # modelos, dinero, contrato IPC
src/                   # renderer React + shadcn
resources/             # assets de empaquetado (iconos, etc.)
electron-builder.yml   # config del instalador Windows
release/               # salida de dist/package (gitignored)
```

## Seguridad Electron

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- UI solo habla con `window.api` (preload)
