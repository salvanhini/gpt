-- FEMIC GPT Supabase RLS setup
-- Execute no SQL Editor do Supabase depois de habilitar Authentication.

create extension if not exists pgcrypto;

create table if not exists public.mensagens_chat (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  role text not null,
  content text not null,
  meta jsonb not null default '{}',
  user_id text default 'default',
  owner_id uuid references auth.users(id) on delete cascade
);

alter table public.mensagens_chat
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_mensagens_chat_owner on public.mensagens_chat(owner_id);
create index if not exists idx_mensagens_chat_session on public.mensagens_chat(session_id);
create index if not exists idx_mensagens_chat_created on public.mensagens_chat(created_at);

alter table public.mensagens_chat enable row level security;

drop policy if exists mensagens_chat_select_own on public.mensagens_chat;
drop policy if exists mensagens_chat_insert_own on public.mensagens_chat;
drop policy if exists mensagens_chat_update_own on public.mensagens_chat;
drop policy if exists mensagens_chat_delete_own on public.mensagens_chat;

create policy mensagens_chat_select_own
on public.mensagens_chat
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy mensagens_chat_insert_own
on public.mensagens_chat
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy mensagens_chat_update_own
on public.mensagens_chat
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy mensagens_chat_delete_own
on public.mensagens_chat
for delete
to authenticated
using ((select auth.uid()) = owner_id);
