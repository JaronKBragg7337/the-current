create table if not exists public.the_current_era_archives (
  era_id text primary key,
  source_world_id text not null,
  label text not null,
  seed text not null,
  final_day integer not null check (final_day >= 0),
  digest text not null,
  snapshot jsonb not null,
  world_day_ms bigint not null check (world_day_ms > 0),
  genesis_at timestamptz not null,
  frozen_at timestamptz not null default now(),
  engine_version text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.the_current_era_archives is
  'Immutable authoritative snapshots of retired shared-world eras. Service-role only.';

alter table public.the_current_era_archives enable row level security;
revoke all on table public.the_current_era_archives from anon, authenticated;

create table if not exists public.the_current_era_entropy (
  era_id text not null references public.the_current_era_archives(era_id) on delete cascade,
  day integer not null check (day > 0),
  entropy text not null,
  created_at timestamptz not null,
  primary key (era_id, day)
);

comment on table public.the_current_era_entropy is
  'Replay inputs retained with a retired era. Service-role only.';

alter table public.the_current_era_entropy enable row level security;
revoke all on table public.the_current_era_entropy from anon, authenticated;

create index if not exists the_current_era_entropy_created_at_idx
  on public.the_current_era_entropy (era_id, created_at);
