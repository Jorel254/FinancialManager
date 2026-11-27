import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { formatMxn } from "@shared/money";
import type {
  Category,
  PaymentPriority,
  PendingPaymentView,
} from "@shared/models";
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
import {
  cnUrgencyBadge,
  priorityLabel,
  statusLabel,
  urgencyAccentBar,
  urgencyLabels,
  urgencyOf,
  urgencyRowClass,
} from "@/lib/urgency";
import { cn } from "@/lib/utils";

interface PendingPaymentsPageProps {
  onMutate?: () => void;
}

interface FormState {
  description: string;
  amount: string;
  dueOn: string;
  categoryId: string;
  priority: PaymentPriority;
  notes: string;
}

interface ApplyFormState {
  amount: string;
  appliedOn: string;
  notes: string;
}

type FilterTab = "open" | "paid" | "all";

function emptyForm(defaultCategoryId = ""): FormState {
  return {
    description: "",
    amount: "",
    dueOn: todayIsoDate(),
    categoryId: defaultCategoryId,
    priority: 2,
    notes: "",
  };
}

function emptyApplyForm(remainingCents: number): ApplyFormState {
  return {
    amount: centsToInputValue(remainingCents),
    appliedOn: todayIsoDate(),
    notes: "",
  };
}

export function PendingPaymentsPage({ onMutate }: PendingPaymentsPageProps) {
  const [items, setItems] = useState<PendingPaymentView[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("open");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PendingPaymentView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [applyTarget, setApplyTarget] = useState<PendingPaymentView | null>(
    null,
  );
  const [applyMode, setApplyMode] = useState<"partial" | "full">("partial");
  const [applyForm, setApplyForm] = useState<ApplyFormState>(emptyApplyForm(0));
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [confirmDelete, setConfirmDelete] =
    useState<PendingPaymentView | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [detail, setDetail] = useState<PendingPaymentView | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

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
        api.pending.list(),
        api.categories.list("pending_payment"),
      ]);
      if (!listResult.ok) {
        setError(listResult.error.message);
        return;
      }
      if (!catsResult.ok) {
        setError(catsResult.error.message);
        return;
      }
      setItems(listResult.data);
      setCategories(catsResult.data);
      setDetail((prev) =>
        prev
          ? (listResult.data.find((item) => item.id === prev.id) ?? null)
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "open") {
      return items.filter((item) => item.status !== "paid");
    }
    if (filter === "paid") {
      return items.filter((item) => item.status === "paid");
    }
    return items;
  }, [filter, items]);

  const openItems = items.filter((item) => item.status !== "paid");
  const remainingOpenCents = openItems.reduce(
    (sum, item) => sum + item.remainingCents,
    0,
  );

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setForm(emptyForm(categories[0]?.id ?? ""));
    setFormOpen(true);
  }

  function openEdit(item: PendingPaymentView) {
    setEditing(item);
    setFormError(null);
    setForm({
      description: item.description,
      amount: centsToInputValue(item.totalAmountCents),
      dueOn: item.dueOn,
      categoryId: item.categoryId,
      priority: item.priority,
      notes: item.notes ?? "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  }

  function openApply(item: PendingPaymentView, mode: "partial" | "full") {
    setApplyTarget(item);
    setApplyMode(mode);
    setApplyError(null);
    setApplyForm(emptyApplyForm(item.remainingCents));
  }

  function closeApply() {
    if (applying) return;
    setApplyTarget(null);
    setApplyError(null);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!hasApi()) return;

    const description = form.description.trim();
    if (!description) {
      setFormError("La descripción es obligatoria.");
      return;
    }
    const totalAmountCents = parsePesosInput(form.amount);
    if (totalAmountCents === null) {
      setFormError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!form.categoryId) {
      setFormError("Elige una categoría.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueOn)) {
      setFormError("La fecha de vencimiento no es válida.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const api = getApi();
      const payload = {
        description,
        totalAmountCents,
        dueOn: form.dueOn,
        categoryId: form.categoryId,
        priority: form.priority,
        notes: form.notes.trim() ? form.notes.trim() : null,
      };
      const result = editing
        ? await api.pending.update(editing.id, payload)
        : await api.pending.create(payload);

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

  async function submitApply(event: FormEvent) {
    event.preventDefault();
    if (!applyTarget || !hasApi()) return;

    const amountCents =
      applyMode === "full"
        ? applyTarget.remainingCents
        : parsePesosInput(applyForm.amount);

    if (amountCents === null) {
      setApplyError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (amountCents > applyTarget.remainingCents) {
      setApplyError("El monto supera el restante por liquidar.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyForm.appliedOn)) {
      setApplyError("La fecha del pago no es válida.");
      return;
    }

    setApplying(true);
    setApplyError(null);
    try {
      const result = await getApi().pending.applyPayment({
        pendingPaymentId: applyTarget.id,
        amountCents,
        appliedOn: applyForm.appliedOn,
        notes: applyForm.notes.trim() ? applyForm.notes.trim() : null,
      });
      if (!result.ok) {
        setApplyError(result.error.message);
        return;
      }
      setApplyTarget(null);
      await load();
      onMutate?.();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "No se pudo aplicar");
    } finally {
      setApplying(false);
    }
  }

  async function confirmDeleteRow() {
    if (!confirmDelete || !hasApi()) return;
    setDeletingId(confirmDelete.id);
    try {
      const result = await getApi().pending.delete(confirmDelete.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setConfirmDelete(null);
      if (detail?.id === confirmDelete.id) setDetail(null);
      await load();
      onMutate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  async function undoApplication(applicationId: string) {
    if (!hasApi()) return;
    setUndoingId(applicationId);
    try {
      const result = await getApi().pending.removeApplication(applicationId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await load();
      onMutate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer");
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Compromisos
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Pagos pendientes
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Ordenados por vencimiento. Liquidar crea un egreso ligado — el saldo
            baja una sola vez.
          </p>
        </div>
        <Button className="shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo pago
        </Button>
      </header>

      <section className="animate-fade-up-delay-1 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Abiertos
            </p>
            <p className="mt-2 font-display text-3xl font-bold">
              {openItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Restante por pagar
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-pending">
              {formatMxn(remainingOpenCents)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Liquidados
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-income">
              {items.filter((item) => item.status === "paid").length}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="animate-fade-up-delay-1 flex flex-wrap gap-2">
        {(
          [
            { id: "open", label: "Activos" },
            { id: "paid", label: "Liquidados" },
            { id: "all", label: "Todos" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant={filter === tab.id ? "default" : "outline"}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

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
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="px-5 py-14 text-center">
              <div className="mx-auto mb-4 inline-flex rounded-xl border border-pending/40 bg-pending/10 px-3 py-1.5 text-xs font-semibold text-pending">
                Lista vacía
              </div>
              <p className="font-display text-xl font-semibold">
                {filter === "paid"
                  ? "Sin pagos liquidados"
                  : "Aún no hay pagos pendientes"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {filter === "paid"
                  ? "Cuando marques un compromiso como pagado aparecerá aquí."
                  : "Registra tarjeta, servicios, suscripciones u otros compromisos."}
              </p>
              {filter !== "paid" ? (
                <Button className="mt-6" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Registrar el primero
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const urgency = urgencyOf(item.dueOn);
              const isPaid = item.status === "paid";
              return (
                <li
                  key={item.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border px-4 py-4 backdrop-blur-sm transition-colors",
                    urgencyRowClass(urgency, isPaid),
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      isPaid ? "bg-income/60" : urgencyAccentBar(urgency),
                    )}
                  />
                  <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">
                          {item.description}
                        </p>
                        {!isPaid ? (
                          <span className={cnUrgencyBadge(urgency)}>
                            {urgencyLabels[urgency]}
                          </span>
                        ) : null}
                        <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {statusLabel(item.status)}
                        </span>
                        <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {categoryName(item.categoryId)}
                        </span>
                        <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                          Prioridad {priorityLabel(item.priority)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Vence {formatDisplayDate(item.dueOn)}
                        {item.paidCents > 0
                          ? ` · Pagado ${formatMxn(item.paidCents)} de ${formatMxn(item.totalAmountCents)}`
                          : ` · Total ${formatMxn(item.totalAmountCents)}`}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <p className="font-display text-xl font-bold tabular-nums text-pending">
                        {formatMxn(isPaid ? item.totalAmountCents : item.remainingCents)}
                      </p>
                      {!isPaid ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openApply(item, "partial")}
                          >
                            <CircleDollarSign className="h-4 w-4" />
                            Parcial
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openApply(item, "full")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Marcar pagado
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetail(item)}
                        aria-label="Ver aplicaciones"
                      >
                        <ListTree className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(item)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(item)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Editar pago" : "Nuevo pago pendiente"}
        description="Registrar un compromiso no modifica el saldo disponible."
      >
        <form className="space-y-4" onSubmit={(e) => void submitForm(e)}>
          <div className="space-y-2">
            <Label htmlFor="pp-description">Descripción</Label>
            <Input
              id="pp-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Ej. Tarjeta BBVA"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-amount">Monto total (MXN)</Label>
              <Input
                id="pp-amount"
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
              <Label htmlFor="pp-due">Fecha de vencimiento</Label>
              <Input
                id="pp-due"
                type="date"
                value={form.dueOn}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dueOn: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-category">Categoría</Label>
              <Select
                id="pp-category"
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
              <Label htmlFor="pp-priority">Prioridad</Label>
              <Select
                id="pp-priority"
                value={String(form.priority)}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: Number(e.target.value) as PaymentPriority,
                  }))
                }
              >
                <option value="1">Alta</option>
                <option value="2">Media</option>
                <option value="3">Baja</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pp-notes">Notas (opcional)</Label>
            <Textarea
              id="pp-notes"
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
        open={Boolean(applyTarget)}
        onClose={closeApply}
        title={
          applyMode === "full" ? "Marcar como pagado" : "Registrar pago parcial"
        }
        description={
          applyTarget
            ? `Restante: ${formatMxn(applyTarget.remainingCents)}. Se creará un egreso ligado.`
            : undefined
        }
      >
        <form className="space-y-4" onSubmit={(e) => void submitApply(e)}>
          {applyMode === "partial" ? (
            <div className="space-y-2">
              <Label htmlFor="pp-apply-amount">Monto a pagar (MXN)</Label>
              <Input
                id="pp-apply-amount"
                inputMode="decimal"
                value={applyForm.amount}
                onChange={(e) =>
                  setApplyForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>
          ) : (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              Se liquidará el restante completo
              {applyTarget ? ` (${formatMxn(applyTarget.remainingCents)})` : ""}.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pp-apply-date">Fecha del pago</Label>
            <Input
              id="pp-apply-date"
              type="date"
              value={applyForm.appliedOn}
              onChange={(e) =>
                setApplyForm((prev) => ({
                  ...prev,
                  appliedOn: e.target.value,
                }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pp-apply-notes">Notas (opcional)</Label>
            <Textarea
              id="pp-apply-notes"
              value={applyForm.notes}
              onChange={(e) =>
                setApplyForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          {applyError ? (
            <p className="text-sm text-destructive">{applyError}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeApply}
              disabled={applying}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={applying}>
              {applying
                ? "Aplicando…"
                : applyMode === "full"
                  ? "Liquidar"
                  : "Aplicar parcial"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => (deletingId ? undefined : setConfirmDelete(null))}
        title="Eliminar pago pendiente"
        description="Si tiene liquidaciones, también se eliminarán los egresos ligados."
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar{" "}
          <span className="font-medium text-foreground">
            {confirmDelete?.description}
          </span>
          {confirmDelete
            ? ` (${formatMxn(confirmDelete.totalAmountCents)})`
            : ""}
          ?
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

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.description ?? "Detalle"}
        description="Aplicaciones de pago y egresos ligados."
        className="max-w-xl"
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted-foreground">
                Total:{" "}
                <span className="font-medium text-foreground">
                  {formatMxn(detail.totalAmountCents)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Pagado:{" "}
                <span className="font-medium text-foreground">
                  {formatMxn(detail.paidCents)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Restante:{" "}
                <span className="font-medium text-pending">
                  {formatMxn(detail.remainingCents)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Estado:{" "}
                <span className="font-medium text-foreground">
                  {statusLabel(detail.status)}
                </span>
              </p>
            </div>

            {detail.applications.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                Todavía no hay aplicaciones de pago.
              </p>
            ) : (
              <ul className="space-y-2">
                {detail.applications.map((app) => (
                  <li
                    key={app.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {formatMxn(app.amountCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(app.appliedOn)}
                        {app.notes ? ` · ${app.notes}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={undoingId === app.id}
                      onClick={() => void undoApplication(app.id)}
                    >
                      <Undo2 className="h-4 w-4" />
                      {undoingId === app.id ? "…" : "Deshacer"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
