-- Phase 4 prep: household-wide settings. Single-row table.
-- week_starts_on: 0 = Sunday, 1 = Monday (ISO).
-- Run in Supabase SQL editor.

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  week_starts_on int not null default 1 check (week_starts_on between 0 and 6),
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

insert into app_settings (id) values (1) on conflict do nothing;
