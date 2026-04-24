-- Owner-only forum (stored in Supabase; accessed via server APIs with owner cookie).

create table if not exists public.rentadria_owner_forum_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  initial_body text not null default '',
  author_user_id text not null,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rentadria_owner_forum_topics_created_idx
  on public.rentadria_owner_forum_topics (created_at desc);

create table if not exists public.rentadria_owner_forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.rentadria_owner_forum_topics(id) on delete cascade,
  author_user_id text not null,
  author_name text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rentadria_owner_forum_replies_topic_idx
  on public.rentadria_owner_forum_replies (topic_id, created_at asc);

alter table public.rentadria_owner_forum_topics enable row level security;
alter table public.rentadria_owner_forum_replies enable row level security;

