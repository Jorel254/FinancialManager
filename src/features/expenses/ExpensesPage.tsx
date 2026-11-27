import { MovementCrudPage } from "@/features/movements/MovementCrudPage";

interface ExpensesPageProps {
  onMutate?: () => void;
}

export function ExpensesPage({ onMutate }: ExpensesPageProps) {
  return <MovementCrudPage kind="expense" onMutate={onMutate} />;
}
