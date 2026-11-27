import { parsePesosDecimalString } from "../../shared/money";

/** Parsea texto de pesos (ej. "1,250.50" o "1250,50") a centavos. */
export function parsePesosInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    // Separador de miles con coma: 1,250.50
    normalized = normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    // Decimal con coma: 1250,50
    normalized = normalized.replace(",", ".");
  }

  // Más de 2 decimales → inválido (evita ambigüedad de redondeo).
  const decimalPart = normalized.includes(".")
    ? normalized.split(".")[1] ?? ""
    : "";
  if (decimalPart.length > 2) return null;

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;

  try {
    const cents = parsePesosDecimalString(normalized);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}
