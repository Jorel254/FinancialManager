import type { AppSettings } from "../../../shared/models";
import { getDatabase } from "../connection";

const HIDE_AMOUNTS_KEY = "hide_amounts";

function readFlag(key: string, fallback: boolean): boolean {
  const db = getDatabase();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) return fallback;
  return row.value === "1" || row.value === "true";
}

function writeFlag(key: string, value: boolean): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
    `,
  ).run(key, value ? "1" : "0", new Date().toISOString());
}

export function getAppSettings(): AppSettings {
  return {
    hideAmounts: readFlag(HIDE_AMOUNTS_KEY, false),
  };
}

export function updateAppSettings(
  patch: Partial<AppSettings>,
): AppSettings {
  if (typeof patch.hideAmounts === "boolean") {
    writeFlag(HIDE_AMOUNTS_KEY, patch.hideAmounts);
  }
  return getAppSettings();
}
