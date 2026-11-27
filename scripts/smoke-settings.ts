/**
 * Smoke — preferencia hideAmounts en SQLite.
 * Uso: npx tsx scripts/smoke-settings.ts
 */
import assert from "node:assert/strict";
import { closeDatabase, openDatabaseAt } from "../electron/db/connection";
import {
  getAppSettings,
  updateAppSettings,
} from "../electron/db/repositories/settings";

openDatabaseAt(":memory:", { fresh: true });

const initial = getAppSettings();
assert.equal(initial.hideAmounts, false, "default hideAmounts = false");

const enabled = updateAppSettings({ hideAmounts: true });
assert.equal(enabled.hideAmounts, true);

const stillEnabled = getAppSettings();
assert.equal(stillEnabled.hideAmounts, true, "persiste en la misma sesión DB");

const disabled = updateAppSettings({ hideAmounts: false });
assert.equal(disabled.hideAmounts, false);

closeDatabase();
console.log("OK smoke-settings");
