-- 身体课表 · fit.hiesther.me — run once in Supabase → SQL Editor.
-- Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- One row per user: the whole app state as JSON, plus a pre-computed summary for agents.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  summary    jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own data: read"   on public.user_data;
drop policy if exists "own data: insert" on public.user_data;
drop policy if exists "own data: update" on public.user_data;
drop policy if exists "own data: delete" on public.user_data;
create policy "own data: read"   on public.user_data for select using (auth.uid() = user_id);
create policy "own data: insert" on public.user_data for insert with check (auth.uid() = user_id);
create policy "own data: update" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data: delete" on public.user_data for delete using (auth.uid() = user_id);

-- Read-only keys a user hands to their own agent. Only the sha256 hash is stored.
create table if not exists public.agent_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  token_hash   text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

alter table public.agent_tokens enable row level security;

drop policy if exists "own tokens: read"   on public.agent_tokens;
drop policy if exists "own tokens: insert" on public.agent_tokens;
drop policy if exists "own tokens: revoke" on public.agent_tokens;
create policy "own tokens: read"   on public.agent_tokens for select using (auth.uid() = user_id);
create policy "own tokens: insert" on public.agent_tokens for insert with check (auth.uid() = user_id);
create policy "own tokens: revoke" on public.agent_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The one door for agents: POST /rest/v1/rpc/agent_summary { "token": "fit_…", include_data: false }
-- Works with the public anon key; the token itself is the credential. Read-only by construction.
create or replace function public.agent_summary(token text, include_data boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t   public.agent_tokens;
  ud  public.user_data;
begin
  select * into t from public.agent_tokens
   where token_hash = encode(digest(token, 'sha256'), 'hex') and revoked_at is null;
  if not found then
    raise exception 'invalid or revoked token' using errcode = '28000';
  end if;

  update public.agent_tokens set last_used_at = now() where id = t.id;
  select * into ud from public.user_data where user_id = t.user_id;
  if not found then
    return jsonb_build_object('updated_at', null, 'summary', null);
  end if;

  return jsonb_build_object('updated_at', ud.updated_at, 'summary', ud.summary)
      || case when include_data then jsonb_build_object('data', ud.data) else '{}'::jsonb end;
end;
$$;

revoke all on function public.agent_summary(text, boolean) from public;
grant execute on function public.agent_summary(text, boolean) to anon, authenticated;
