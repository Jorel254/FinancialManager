/**
 * Urgencia visual de vencimientos (día local YYYY-MM-DD).
 */

import type { DueUrgency } from "./models";

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function urgencyFor(dueOn: string, today: string): DueUrgency {
  const delta = daysBetweenIso(today, dueOn);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta <= 3) return "within_3_days";
  if (delta <= 7) return "within_7_days";
  return "later";
}

export function urgencyRank(urgency: DueUrgency): number {
  switch (urgency) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "within_3_days":
      return 2;
    case "within_7_days":
      return 3;
    default:
      return 4;
  }
}

export const urgencyLabels: Record<DueUrgency, string> = {
  overdue: "Vencido",
  today: "Vence hoy",
  within_3_days: "En 3 días",
  within_7_days: "En 7 días",
  later: "Próximo",
};
