import sql001 from "./001_initial.sql?raw";

export interface Migration {
  id: string;
  sql: string;
}

/** Migraciones ordenadas por id lexicográfico. */
export const migrations: Migration[] = [
  { id: "001_initial", sql: sql001 },
];
