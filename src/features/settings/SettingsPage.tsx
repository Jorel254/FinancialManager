import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/features/settings/SettingsContext";

export function SettingsPage() {
  const { settings, loading, error, setHideAmounts } = useSettings();
  const hideAmounts = settings.hideAmounts;

  return (
    <div className="space-y-8">
      <header className="animate-fade-up space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Preferencias
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Configuración
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Ajustes locales de la aplicación. Se guardan en SQLite y persisten
          entre reinicios.
        </p>
      </header>

      <section className="animate-fade-up-delay-1 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {hideAmounts ? (
                <EyeOff className="h-4 w-4 text-primary" />
              ) : (
                <Eye className="h-4 w-4 text-primary" />
              )}
              Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="hide-amounts" className="normal-case tracking-normal text-sm text-foreground">
                  Ocultar montos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enmascara el saldo disponible y los montos de ingresos en el
                  dashboard y en las vistas donde aparecen. Egresos y pagos
                  pendientes siguen visibles.
                </p>
              </div>
              <Switch
                id="hide-amounts"
                checked={hideAmounts}
                disabled={loading}
                onCheckedChange={(next) => {
                  void setHideAmounts(next);
                }}
                aria-label="Ocultar montos"
              />
            </div>
            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
            {!loading && !error ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Estado actual:{" "}
                {hideAmounts
                  ? "montos de ingresos y saldo ocultos"
                  : "montos visibles"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
