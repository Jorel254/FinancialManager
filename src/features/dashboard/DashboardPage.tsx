import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Target,
  Wallet,
} from "lucide-react";
import { formatMxn } from "@shared/money";
import type { FinanceSummary, UpcomingPaymentItem } from "@shared/models";
import { UrgencyLegend } from "@/components/UrgencyLegend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApi, hasApi } from "@/lib/api";
import { formatDisplayDate } from "@/lib/dates";
import {
  cnUrgencyBadge,
  groupByUrgency,
  urgencyAccentBar,
  urgencyLabels,
  urgencyRowClass,
} from "@/lib/urgency";
import { cn } from "@/lib/utils";

function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const metricClass = [
  "animate-fade-up",
  "animate-fade-up-delay-1",
  "animate-fade-up-delay-2",
  "animate-fade-up-delay-3",
  "animate-fade-up-delay-3",
] as const;

interface DashboardPageProps {
  /** Se incrementa tras mutaciones financieras. */
  refreshToken?: number;
}

export function DashboardPage({ refreshToken = 0 }: DashboardPageProps) {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingPaymentItem[]>([]);
  const [ipcOk, setIpcOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasApi()) {
        setError("Preload no disponible (¿abriste la app con Electron?)");
        return;
      }
      try {
        const result = await getApi().finance.summary(currentMonth());
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        setError(null);
        setIpcOk(true);
        setSummary(result.data.summary);
        setUpcoming(result.data.upcoming);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al consultar IPC");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const upcomingPreview = useMemo(() => upcoming.slice(0, 8), [upcoming]);
  const groupedUpcoming = useMemo(
    () => groupByUrgency(upcomingPreview),
    [upcomingPreview],
  );

  const cards = [
    {
      title: "Saldo disponible",
      value: summary?.availableBalanceCents ?? 0,
      icon: Wallet,
      tone: "text-primary",
    },
    {
      title: "Ingresos del mes",
      value: summary?.incomeMonthCents ?? 0,
      icon: ArrowUpRight,
      tone: "text-income",
    },
    {
      title: "Egresos del mes",
      value: summary?.expenseMonthCents ?? 0,
      icon: ArrowDownRight,
      tone: "text-expense",
    },
    {
      title: "Pagos pendientes del mes",
      value: summary?.committedMonthCents ?? 0,
      icon: CalendarClock,
      tone: "text-pending",
    },
    {
      title: "Saldo proyectado",
      value: summary?.projectedBalanceCents ?? 0,
      icon: Target,
      tone: "text-primary",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Resumen
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Tu mes de un vistazo
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Saldo, movimientos del mes y compromisos reales. Los vencidos y
          próximos se destacan al abrir.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              ipcOk
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                ipcOk ? "bg-primary animate-pulse-soft" : "bg-muted-foreground"
              }`}
            />
            {ipcOk ? "IPC conectado (window.api)" : "Esperando IPC…"}
          </span>
          {summary ? (
            <span className="text-xs text-muted-foreground">
              Mes {summary.month}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className={metricClass[index]}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold tracking-tight">
                  {formatMxn(card.value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="animate-fade-up-delay-3">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Próximos pagos</CardTitle>
            {upcoming.length > 0 ? <UrgencyLegend /> : null}
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-5 py-10 text-center">
                <p className="font-display text-lg font-semibold text-foreground">
                  Sin compromisos abiertos
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Registra un pago pendiente para verlo aquí con resaltado de
                  urgencia.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedUpcoming.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {group.kind === "urgency" ? (
                        <span className={cnUrgencyBadge(group.urgency)}>
                          {group.title}
                        </span>
                      ) : (
                        <span className="rounded-md border border-income/40 bg-income/10 px-2 py-0.5 text-[11px] font-semibold text-income">
                          {group.title}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className={cn(
                            "relative overflow-hidden rounded-xl border px-4 py-3",
                            urgencyRowClass(item.urgency),
                          )}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 w-1",
                              urgencyAccentBar(item.urgency),
                            )}
                          />
                          <div className="flex items-center justify-between gap-4 pl-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-foreground">
                                  {item.description}
                                </p>
                                <span className={cnUrgencyBadge(item.urgency)}>
                                  {urgencyLabels[item.urgency]}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Vence {formatDisplayDate(item.dueOn)}
                                {item.status === "partial"
                                  ? ` · Parcial · resta ${formatMxn(item.remainingCents)}`
                                  : ""}
                                {` · Prioridad ${item.priority === 1 ? "alta" : item.priority === 2 ? "media" : "baja"}`}
                              </p>
                            </div>
                            <p className="shrink-0 font-display text-base font-semibold text-pending">
                              {formatMxn(item.remainingCents)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
