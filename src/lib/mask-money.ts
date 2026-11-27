import { formatMxn } from "@shared/money";

/** Máscara visual cuando "Ocultar montos" está activo. */
export const MASKED_AMOUNT = "$••••••";

export function formatMaybeHiddenMxn(
  cents: number,
  hideAmounts: boolean,
): string {
  return hideAmounts ? MASKED_AMOUNT : formatMxn(cents);
}
