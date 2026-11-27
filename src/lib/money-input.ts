import { pesosToCents } from "@shared/money";

/** Parsea texto de pesos (ej. "1,250.50" o "1250,50") a centavos. */
export function parsePesosInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const pesos = Number(normalized);
  if (!Number.isFinite(pesos) || pesos <= 0) return null;

  try {
    const cents = pesosToCents(pesos);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}
