-- Unbriefed: credits system schema. Paste this whole file into Supabase SQL Editor and Run once.

-- One row per signed-in user, tracking their credit balance.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits integer not null default 3,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

-- Auto-create a profile with 3 free credits the moment someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 3)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomically spend one credit. Returns true if a credit was available and spent, false if not —
-- this runs as a single SQL statement so two simultaneous requests can't both spend the last credit.
create or replace function public.spend_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
    set credits = credits - 1
    where id = p_user_id and credits > 0
    returning credits into remaining;
  return remaining is not null;
end;
$$;

-- Add credits (used by the Stripe webhook after a successful purchase, and to refund a credit
-- when a generation falls back to the offline placeholder).
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set credits = credits + p_amount where id = p_user_id;
end;
$$;

-- Idempotency log for payment events (Razorpay payment ids), so a payment that's confirmed both
-- by the client-side verify call AND the webhook — or a retried webhook delivery — never double-credits.
create table if not exists public.processed_payment_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.processed_payment_events enable row level security;
-- No select/insert policies for regular users — only the service_role key (server-side) touches
-- this table, and service_role bypasses RLS entirely.
