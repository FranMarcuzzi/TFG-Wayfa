-- Trip expenses tables
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  paid_by uuid not null references public.user_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.trip_expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  user_id uuid not null references public.user_profiles(user_id) on delete restrict,
  share_cents integer not null check (share_cents >= 0)
);
-- Helpful indexes
create index if not exists idx_trip_expenses_trip on public.trip_expenses(trip_id);
create index if not exists idx_trip_expense_splits_expense on public.trip_expense_splits(expense_id);
create index if not exists idx_trip_expense_splits_user on public.trip_expense_splits(user_id);
-- RLS (disabled for now; align with existing project setup)
alter table public.trip_expenses disable row level security;
alter table public.trip_expense_splits disable row level security;
