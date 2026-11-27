import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { formatMxn } from "@shared/money";
import type {
  Category,
  HistoryFilters,
  HistoryItem,
  HistoryItemType,
} from "@shared/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useSettings } from "@/features/settings/SettingsContext";
import { getApi, hasApi } from "@/lib/api";
import { formatDisplayDate } from "@/lib/dates";
import { formatMaybeHiddenMxn } from "@/lib/mask-money";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: "" | HistoryItemType; label: string }[] = [
  { value: "", label: "Todos los tipos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Egresos" },
  { value: "pending", label: "Pagos pendientes" },
  { value: "application", label: "Pagos realizados" },
];

const TYPE_BADGE: Record<
  HistoryItemType,
  { label: string; className: string }
> = {
  income: {
    label: "Ingreso",
    className: "border-income/40 bg-income/15 text-income",
  },
  expense: {
    label: "Egreso",
    className: "border-expense/40 bg-expense/15 text-expense",
  },
  pending: {
    label: "Pendiente",
    className: "border-pending/40 bg-pending/15 text-pending",
  },
  application: {
    label: "Realizado",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
};

const AMOUNT_TONE: Record<HistoryItemType, string> = {
  income: "text-income",
  expense: "text-expense",
  pending: "text-pending",
  application: "text-primary",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
};

interface FilterState {
  type: "" | HistoryItemType;
  categoryId: string;
  from: string;
  to: string;
  query: string;
}

const emptyFilters: FilterState = {
  type: "",
  categoryId: "",
  from: "",
  to: "",
  query: "",
};

function toApiFilters(state: FilterState): HistoryFilters {
  const filters: HistoryFilters = {};
  if (state.type) filters.type = state.type;
  if (state.categoryId) filters.categoryId = state.categoryId;
  if (state.from) filters.from = state.from;
  if (state.to) filters.to = state.to;
  if (state.query.trim()) filters.query = state.query.trim();
  return filters;
}

interface HistoryPageProps {
  refreshToken?: number;
}

export function HistoryPage({ refreshToken = 0 }: HistoryPageProps) {
  const { settings } = useSettings();
  const hideAmounts = settings.hideAmounts;
  const [draft, setDraft] = useState<FilterState>(emptyFilters);
  const [applied, setApplied] = useState<FilterState>(emptyFilters);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      if (!hasApi()) return;
      const result = await getApi().categories.list();
      if (cancelled || !result.ok) return;
      setCategories(result.data);
    }

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!hasApi()) {
        setError("Preload no disponible (¿abriste la app con Electron?)");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getApi().history.query(toApiFilters(applied));
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error.message);
          setItems([]);
          return;
        }
        setError(null);
        setItems(result.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al consultar");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [applied, refreshToken]);

  const categoryOptions = useMemo(() => {
    if (!draft.type) return categories;
    if (draft.type === "income") {
      return categories.filter((c) => c.kind === "income");
    }
    if (draft.type === "expense") {
      return categories.filter((c) => c.kind === "expense");
    }
    return categories.filter((c) => c.kind === "pending_payment");
  }, [categories, draft.type]);

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("La fecha «desde» no puede ser posterior a «hasta».");
      return;
    }
    setError(null);
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Consultas
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Historial
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Filtra ingresos, egresos, pagos pendientes y liquidaciones por tipo,
          categoría, fechas o descripción.
        </p>
      </header>

      <Card className="animate-fade-up-delay-1">
        <CardContent className="pt-6">
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"
            onSubmit={applyFilters}
          >
            <div className="space-y-2">
              <Label htmlFor="history-type">Tipo</Label>
              <Select
                id="history-type"
                value={draft.type}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    type: e.target.value as FilterState["type"],
                    categoryId: "",
                  }))
                }
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-category">Categoría</Label>
              <Select
                id="history-category"
                value={draft.categoryId}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    categoryId: e.target.value,
                  }))
                }
              >
                <option value="">Todas</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-from">Desde</Label>
              <Input
                id="history-from"
                type="date"
                value={draft.from}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-to">Hasta</Label>
              <Input
                id="history-to"
                type="date"
                value={draft.to}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="history-query">Descripción</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="history-query"
                  className="pl-9"
                  placeholder="Buscar por texto…"
                  value={draft.query}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, query: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
              <Button type="submit">Aplicar filtros</Button>
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Limpiar
              </Button>
              <span className="text-xs text-muted-foreground">
                {loading
                  ? "Cargando…"
                  : `${items.length} resultado${items.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <p className="animate-fade-up text-sm text-destructive">{error}</p>
      ) : null}

      <section className="animate-fade-up-delay-2 space-y-3">
        {!loading && items.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-5 py-12 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              Sin resultados
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Prueba otro rango, tipo o texto de búsqueda.
            </p>
          </div>
        ) : null}

        <ul className="space-y-2">
          {items.map((item) => {
            const badge = TYPE_BADGE[item.type];
            const amountPrefix =
              item.type === "expense" || item.type === "application"
                ? "−"
                : item.type === "income"
                  ? "+"
                  : "";
            return (
              <li key={`${item.type}-${item.id}`}>
                <div className="rounded-xl border border-border/70 bg-card/50 px-4 py-3 backdrop-blur-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                        {item.type === "pending" && item.status ? (
                          <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        ) : null}
                        <p className="truncate font-medium text-foreground">
                          {item.description}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(item.date)}
                        {" · "}
                        {item.categoryName}
                        {item.type === "pending" &&
                        item.remainingCents !== undefined &&
                        item.status !== "paid"
                          ? ` · Resta ${formatMxn(item.remainingCents)}`
                          : null}
                        {item.notes ? ` · ${item.notes}` : null}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-display text-base font-semibold",
                        AMOUNT_TONE[item.type],
                      )}
                    >
                      {amountPrefix}
                      {item.type === "income"
                        ? formatMaybeHiddenMxn(item.amountCents, hideAmounts)
                        : formatMxn(item.amountCents)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
