import { useCallback, useState } from "react";
import {
  History,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { IncomesPage } from "@/features/incomes/IncomesPage";
import { cn } from "@/lib/utils";

type NavId =
  | "dashboard"
  | "incomes"
  | "expenses"
  | "pending"
  | "history"
  | "settings";

const navItems: { id: NavId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "incomes", label: "Ingresos", icon: PiggyBank },
  { id: "expenses", label: "Egresos", icon: Receipt },
  { id: "pending", label: "Pagos pendientes", icon: WalletCards },
  { id: "history", label: "Historial", icon: History },
  { id: "settings", label: "Configuración", icon: Settings },
];

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="animate-fade-up space-y-3">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-lg text-muted-foreground">
        Sección lista en la navegación. Llega en una etapa posterior.
      </p>
    </div>
  );
}

export function App() {
  const [active, setActive] = useState<NavId>("dashboard");
  const [financeTick, setFinanceTick] = useState(0);

  const notifyMutation = useCallback(() => {
    setFinanceTick((tick) => tick + 1);
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border/70 bg-card/40 px-3 py-5 backdrop-blur-md">
        <div className="mb-8 px-3">
          <p className="font-display text-xl font-extrabold tracking-tight text-primary">
            FinancialManager
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Finanzas locales · Etapa 4
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "h-10 w-full justify-start gap-3 px-3",
                  isActive &&
                    "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
                )}
                onClick={() => setActive(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-6 md:p-8">
        {active === "dashboard" ? (
          <DashboardPage refreshToken={financeTick} />
        ) : null}
        {active === "incomes" ? (
          <IncomesPage onMutate={notifyMutation} />
        ) : null}
        {active === "expenses" ? (
          <ExpensesPage onMutate={notifyMutation} />
        ) : null}
        {active === "pending" ? (
          <PlaceholderSection title="Pagos pendientes" />
        ) : null}
        {active === "history" ? <PlaceholderSection title="Historial" /> : null}
        {active === "settings" ? (
          <PlaceholderSection title="Configuración" />
        ) : null}
      </main>
    </div>
  );
}
