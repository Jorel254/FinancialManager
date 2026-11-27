import {
  cnUrgencyBadge,
  urgencyGroupOrder,
  urgencyLabels,
} from "@/lib/urgency";

export function UrgencyLegend({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <span className="font-medium uppercase tracking-[0.12em]">Urgencia</span>
      {urgencyGroupOrder.map((urgency) => (
        <span key={urgency} className={cnUrgencyBadge(urgency)}>
          {urgencyLabels[urgency]}
        </span>
      ))}
    </div>
  );
}
