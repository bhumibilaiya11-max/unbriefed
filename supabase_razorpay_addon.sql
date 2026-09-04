-- Run this once — adds the table Razorpay payment crediting needs (created after the original
-- supabase_setup.sql was already run, so it wasn't in your database yet).
create table if not exists public.processed_payment_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.processed_payment_events enable row level security;
-- No select/insert policies for regular users — only the service_role key (server-side) touches
-- this table, and service_role bypasses RLS entirely.
