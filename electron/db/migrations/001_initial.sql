PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'pending_payment')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  received_on TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incomes_received_on ON incomes(received_on);
CREATE INDEX IF NOT EXISTS idx_incomes_category_id ON incomes(category_id);

CREATE TABLE IF NOT EXISTS pending_payments (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  due_on TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  priority INTEGER NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'paid')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_due_on ON pending_payments(due_on);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_payments(status);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  spent_on TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  notes TEXT,
  pending_payment_id TEXT REFERENCES pending_payments(id),
  payment_application_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses(spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_pending_payment_id
  ON expenses(pending_payment_id);

CREATE TABLE IF NOT EXISTS payment_applications (
  id TEXT PRIMARY KEY NOT NULL,
  pending_payment_id TEXT NOT NULL REFERENCES pending_payments(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  applied_on TEXT NOT NULL,
  notes TEXT,
  expense_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_applications_expense_id
  ON payment_applications(expense_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_payment_application_id
  ON expenses(payment_application_id)
  WHERE payment_application_id IS NOT NULL;

-- Categorías semilla (ids estables)
INSERT OR IGNORE INTO categories (id, name, kind, is_default, created_at) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Nómina', 'income', 1, '2026-01-01T00:00:00.000Z'),
  ('a1000001-0000-4000-8000-000000000002', 'Freelance', 'income', 1, '2026-01-01T00:00:00.000Z'),
  ('a1000001-0000-4000-8000-000000000003', 'Bonos', 'income', 1, '2026-01-01T00:00:00.000Z'),
  ('a1000001-0000-4000-8000-000000000004', 'Otros', 'income', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000001', 'Alimentación', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000002', 'Transporte', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000003', 'Entretenimiento', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000004', 'Servicios', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000005', 'Compras', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a2000001-0000-4000-8000-000000000006', 'Otros', 'expense', 1, '2026-01-01T00:00:00.000Z'),
  ('a3000001-0000-4000-8000-000000000001', 'Tarjeta', 'pending_payment', 1, '2026-01-01T00:00:00.000Z'),
  ('a3000001-0000-4000-8000-000000000002', 'Servicios', 'pending_payment', 1, '2026-01-01T00:00:00.000Z'),
  ('a3000001-0000-4000-8000-000000000003', 'Suscripciones', 'pending_payment', 1, '2026-01-01T00:00:00.000Z'),
  ('a3000001-0000-4000-8000-000000000004', 'Préstamos', 'pending_payment', 1, '2026-01-01T00:00:00.000Z'),
  ('a3000001-0000-4000-8000-000000000005', 'Otros', 'pending_payment', 1, '2026-01-01T00:00:00.000Z');
