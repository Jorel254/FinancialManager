import { MovementCrudPage } from "@/features/movements/MovementCrudPage";

interface IncomesPageProps {
  onMutate?: () => void;
}

export function IncomesPage({ onMutate }: IncomesPageProps) {
  return <MovementCrudPage kind="income" onMutate={onMutate} />;
}
