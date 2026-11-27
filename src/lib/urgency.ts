import { urgencyFor, urgencyLabels, urgencyRank } from "@shared/due";
import type { DueUrgency } from "@shared/models";
import { todayIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export { urgencyFor, urgencyLabels, urgencyRank };

/** Orden de secciones en listas (vencidos → … → resto). */
export const urgencyGroupOrder: DueUrgency[] = [
  "overdue",
  "today",
  "within_3_days",
  "within_7_days",
  "later",
];

export const urgencyGroupTitles: Record<DueUrgency, string> = {
  overdue: "Vencidos",
  today: "Vencen hoy",
  within_3_days: "Próximos 3 días",
  within_7_days: "Próximos 7 días",
  later: "Más adelante",
};

export type PaymentListGroup<T> =
  | { kind: "urgency"; urgency: DueUrgency; title: string; items: T[] }
  | { kind: "paid"; title: "Liquidados"; items: T[] };

export function urgencyOf(dueOn: string, today = todayIsoDate()): DueUrgency {
  return urgencyFor(dueOn, today);
}

export function urgencyBadgeClass(urgency: DueUrgency): string {
  switch (urgency) {
    case "overdue":
      return "border-destructive/50 bg-destructive/15 text-destructive";
    case "today":
      return "border-pending/50 bg-pending/20 text-pending";
    case "within_3_days":
      return "border-pending/40 bg-pending/10 text-pending";
    case "within_7_days":
      return "border-primary/35 bg-primary/10 text-primary";
    default:
      return "border-border/70 bg-muted/50 text-muted-foreground";
  }
}

export function urgencyRowClass(urgency: DueUrgency, paid = false): string {
  if (paid) return "border-border/50 bg-card/50 opacity-80";
  switch (urgency) {
    case "overdue":
      return "border-destructive/45 bg-destructive/10";
    case "today":
      return "border-pending/45 bg-pending/10";
    case "within_3_days":
      return "border-pending/30 bg-pending/[0.07]";
    case "within_7_days":
      return "border-primary/30 bg-primary/[0.07]";
    default:
      return "border-border/60 bg-card/80";
  }
}

export function urgencyAccentBar(urgency: DueUrgency): string {
  switch (urgency) {
    case "overdue":
      return "bg-destructive";
    case "today":
      return "bg-pending";
    case "within_3_days":
      return "bg-pending/70";
    case "within_7_days":
      return "bg-primary/70";
    default:
      return "bg-border";
  }
}

export function priorityLabel(priority: 1 | 2 | 3): string {
  switch (priority) {
    case 1:
      return "Alta";
    case 2:
      return "Media";
    default:
      return "Baja";
  }
}

export function statusLabel(status: "pending" | "partial" | "paid"): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "partial":
      return "Parcial";
    default:
      return "Pagado";
  }
}

export function cnUrgencyBadge(urgency: DueUrgency, className?: string) {
  return cn(
    "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
    urgencyBadgeClass(urgency),
    className,
  );
}

export function groupByUrgency<T extends { dueOn: string; status?: string }>(
  items: T[],
  today = todayIsoDate(),
): PaymentListGroup<T>[] {
  const buckets = new Map<DueUrgency, T[]>();
  for (const key of urgencyGroupOrder) buckets.set(key, []);

  const paid: T[] = [];
  for (const item of items) {
    if (item.status === "paid") {
      paid.push(item);
      continue;
    }
    const urgency = urgencyOf(item.dueOn, today);
    buckets.get(urgency)!.push(item);
  }

  const groups: PaymentListGroup<T>[] = urgencyGroupOrder
    .map((urgency) => ({
      kind: "urgency" as const,
      urgency,
      title: urgencyGroupTitles[urgency],
      items: buckets.get(urgency) ?? [],
    }))
    .filter((group) => group.items.length > 0);

  if (paid.length > 0) {
    groups.push({ kind: "paid", title: "Liquidados", items: paid });
  }

  return groups;
}
