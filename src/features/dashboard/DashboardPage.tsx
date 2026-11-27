import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { formatMxn } from "@shared/money";
import type { FinanceSummary, UpcomingPaymentItem } from "@shared/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApi, hasApi } from "@/lib/api";

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
] as const;

interface DashboardPageProps {
  /** Se incrementa tras crear/editar/eliminar ingresos o egresos. */
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
      title: "Comprometido del mes",
      value: summary?.committedMonthCents ?? 0,
      icon: CalendarClock,
      tone: "text-pending",
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
          El saldo se recalcula al registrar, editar o eliminar ingresos y
          egresos. Los pagos pendientes llegan en la Etapa 5.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <CardHeader>
            <CardTitle>Próximos pagos</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-5 py-10 text-center">
                <p className="font-display text-lg font-semibold text-foreground">
                  Sin compromisos aún
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Los pagos pendientes se registran en la Etapa 5; el resumen ya
                  refleja ingresos y egresos.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {upcoming.slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence {item.dueOn} · {item.urgency}
                      </p>
                    </div>
                    <p className="font-display text-base font-semibold">
                      {formatMxn(item.remainingCents)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
