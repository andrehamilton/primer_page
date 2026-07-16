create table if not exists public.anonymous_posts (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(trim(content)) between 1 and 280),
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.anonymous_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.anonymous_posts(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists anonymous_posts_created_at_idx
  on public.anonymous_posts (created_at desc);

create index if not exists anonymous_replies_post_id_created_at_idx
  on public.anonymous_replies (post_id, created_at asc);

alter table public.anonymous_posts enable row level security;
alter table public.anonymous_replies enable row level security;

drop policy if exists "Authenticated users can read anonymous posts" on public.anonymous_posts;
drop policy if exists "Authenticated users can create anonymous posts" on public.anonymous_posts;
drop policy if exists "Authenticated users can update post likes" on public.anonymous_posts;
drop policy if exists "Authenticated users can read anonymous replies" on public.anonymous_replies;
drop policy if exists "Authenticated users can create anonymous replies" on public.anonymous_replies;

create policy "Authenticated users can read anonymous posts"
  on public.anonymous_posts
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create anonymous posts"
  on public.anonymous_posts
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update post likes"
  on public.anonymous_posts
  for update
  to authenticated
  using (true)
  with check (likes >= 0);

create policy "Authenticated users can read anonymous replies"
  on public.anonymous_replies
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create anonymous replies"
  on public.anonymous_replies
  for insert
  to authenticated
  with check (true);
