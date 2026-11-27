import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatMxn } from "@shared/money";
import type { Category, Expense, Income } from "@shared/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApi, hasApi } from "@/lib/api";
import { formatDisplayDate, todayIsoDate } from "@/lib/dates";
import { centsToInputValue, parsePesosInput } from "@/lib/money-input";
import { cn } from "@/lib/utils";

export type MovementKind = "income" | "expense";

interface MovementRow {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  categoryId: string;
  notes: string | null;
  locked?: boolean;
}

interface FormState {
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  notes: string;
}

interface MovementCrudPageProps {
  kind: MovementKind;
  onMutate?: () => void;
}

function emptyForm(defaultCategoryId = ""): FormState {
  return {
    description: "",
    amount: "",
    date: todayIsoDate(),
    categoryId: defaultCategoryId,
    notes: "",
  };
}

function toIncomeRow(item: Income): MovementRow {
  return {
    id: item.id,
    description: item.description,
    amountCents: item.amountCents,
    date: item.receivedOn,
    categoryId: item.categoryId,
    notes: item.notes,
  };
}

function toExpenseRow(item: Expense): MovementRow {
  return {
    id: item.id,
    description: item.description,
    amountCents: item.amountCents,
    date: item.spentOn,
    categoryId: item.categoryId,
    notes: item.notes,
    locked: Boolean(item.paymentApplicationId),
  };
}

const copy = {
  income: {
    title: "Ingresos",
    eyebrow: "Entradas",
    subtitle: "Registra lo que entra a tu bolsillo. Cada alta actualiza el saldo.",
    emptyTitle: "Aún no hay ingresos",
    emptyBody: "Agrega tu primer ingreso (nómina, freelance, bono…).",
    createTitle: "Nuevo ingreso",
    editTitle: "Editar ingreso",
    dateLabel: "Fecha de recepción",
    amountTone: "text-income",
    accent: "bg-income/15 text-income border-income/30",
  },
  expense: {
    title: "Egresos",
    eyebrow: "Salidas",
    subtitle: "Anota tus gastos. Se descuentan del saldo disponible al instante.",
    emptyTitle: "Aún no hay egresos",
    emptyBody: "Registra un gasto para empezar a ver el flujo de salida.",
    createTitle: "Nuevo egreso",
    editTitle: "Editar egreso",
    dateLabel: "Fecha del gasto",
    amountTone: "text-expense",
    accent: "bg-expense/15 text-expense border-expense/30",
  },
} as const;

export function MovementCrudPage({ kind, onMutate }: MovementCrudPageProps) {
  const labels = copy[kind];
  const [items, setItems] = useState<MovementRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MovementRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MovementRow | null>(null);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "Sin categoría";
  }, [categories]);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setError("Preload no disponible (¿abriste la app con Electron?)");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const api = getApi();
      const [listResult, catsResult] = await Promise.all([
        kind === "income" ? api.incomes.list() : api.expenses.list(),
        api.categories.list(kind),
      ]);
      if (!listResult.ok) {
        setError(listResult.error.message);
        return;
      }
      if (!catsResult.ok) {
        setError(catsResult.error.message);
        return;
      }
      const rows =
        kind === "income"
          ? (listResult.data as Income[]).map(toIncomeRow)
          : (listResult.data as Expense[]).map(toExpenseRow);
      setItems(rows);
      setCategories(catsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setForm(emptyForm(categories[0]?.id ?? ""));
    setFormOpen(true);
  }

  function openEdit(row: MovementRow) {
    if (row.locked) return;
    setEditing(row);
    setFormError(null);
    setForm({
      description: row.description,
      amount: centsToInputValue(row.amountCents),
      date: row.date,
      categoryId: row.categoryId,
      notes: row.notes ?? "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!hasApi()) return;

    const description = form.description.trim();
    if (!description) {
      setFormError("La descripción es obligatoria.");
      return;
    }
    const amountCents = parsePesosInput(form.amount);
    if (amountCents === null) {
      setFormError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!form.categoryId) {
      setFormError("Elige una categoría.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setFormError("La fecha no es válida.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const api = getApi();
      const notes = form.notes.trim() ? form.notes.trim() : null;
      let result;

      if (kind === "income") {
        const payload = {
          description,
          amountCents,
          receivedOn: form.date,
          categoryId: form.categoryId,
          notes,
        };
        result = editing
          ? await api.incomes.update(editing.id, payload)
          : await api.incomes.create(payload);
      } else {
        const payload = {
          description,
          amountCents,
          spentOn: form.date,
          categoryId: form.categoryId,
          notes,
        };
        result = editing
          ? await api.expenses.update(editing.id, payload)
          : await api.expenses.create(payload);
      }

      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }

      setFormOpen(false);
      setEditing(null);
      await load();
      onMutate?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRow() {
    if (!confirmDelete || !hasApi()) return;
    setDeletingId(confirmDelete.id);
    try {
      const api = getApi();
      const result =
        kind === "income"
          ? await api.incomes.delete(confirmDelete.id)
          : await api.expenses.delete(confirmDelete.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setConfirmDelete(null);
      await load();
      onMutate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  const totalCents = items.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="space-y-8">
      <header className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {labels.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            {labels.title}
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>
        <Button className="shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </header>

      <section className="animate-fade-up-delay-1 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Movimientos
            </p>
            <p className="mt-2 font-display text-3xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Total listado
            </p>
            <p
              className={cn(
                "mt-2 font-display text-3xl font-bold",
                labels.amountTone,
              )}
            >
              {formatMxn(totalCents)}
            </p>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <p className="animate-fade-up text-sm text-destructive">{error}</p>
      ) : null}

      <section className="animate-fade-up-delay-2">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Cargando…
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="px-5 py-14 text-center">
              <div
                className={cn(
                  "mx-auto mb-4 inline-flex rounded-xl border px-3 py-1.5 text-xs font-semibold",
                  labels.accent,
                )}
              >
                Lista vacía
              </div>
              <p className="font-display text-xl font-semibold">
                {labels.emptyTitle}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {labels.emptyBody}
              </p>
              <Button className="mt-6" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Registrar el primero
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border/60 bg-card/80 px-4 py-4 backdrop-blur-sm transition-colors hover:border-primary/35"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {row.description}
                      </p>
                      <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {categoryName(row.categoryId)}
                      </span>
                      {row.locked ? (
                        <span className="rounded-md border border-pending/40 bg-pending/10 px-2 py-0.5 text-[11px] text-pending">
                          Ligado a pago
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(row.date)}
                      {row.notes ? ` · ${row.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <p
                      className={cn(
                        "font-display text-xl font-bold tabular-nums",
                        labels.amountTone,
                      )}
                    >
                      {formatMxn(row.amountCents)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={row.locked}
                      onClick={() => openEdit(row)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={row.locked}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(row)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? labels.editTitle : labels.createTitle}
        description="Los montos se guardan en centavos vía IPC."
      >
        <form className="space-y-4" onSubmit={(e) => void submitForm(e)}>
          <div className="space-y-2">
            <Label htmlFor="mov-description">Descripción</Label>
            <Input
              id="mov-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Ej. Nómina quincenal"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mov-amount">Monto (MXN)</Label>
              <Input
                id="mov-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mov-date">{labels.dateLabel}</Label>
              <Input
                id="mov-date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-category">Categoría</Label>
            <Select
              id="mov-category"
              value={form.categoryId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, categoryId: e.target.value }))
              }
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-notes">Notas (opcional)</Label>
            <Textarea
              id="mov-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Detalle adicional"
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => (deletingId ? undefined : setConfirmDelete(null))}
        title="Eliminar movimiento"
        description="Esta acción no se puede deshacer y recalculará el saldo."
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar{" "}
          <span className="font-medium text-foreground">
            {confirmDelete?.description}
          </span>{" "}
          ({confirmDelete ? formatMxn(confirmDelete.amountCents) : ""})?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(deletingId)}
            onClick={() => setConfirmDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={Boolean(deletingId)}
            onClick={() => void confirmDeleteRow()}
          >
            {deletingId ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
