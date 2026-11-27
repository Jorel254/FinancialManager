import sql001 from "./001_initial.sql?raw";
import sql002 from "./002_app_settings.sql?raw";

export interface Migration {
  id: string;
  sql: string;
}

/** Migraciones ordenadas por id lexicográfico. SQL embebido vía Vite `?raw`. */
export const migrations: Migration[] = [
  { id: "001_initial", sql: sql001 },
  { id: "002_app_settings", sql: sql002 },
];
