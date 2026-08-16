create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.charts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artists text[],
  genre text check (genre in (
    'Blues', 'Country', 'Folk', 'Gospel', 'Hip-Hop', 'Jazz', 'Latin',
    'Mandopop', 'Metal', 'Pop', 'R&B/Soul', 'Reggae', 'Rock', 'Other'
  )),
  key text not null check (key in (
    'C','C#','D','D#','E','F','F#','G','G#','A','A#','B',
    'Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'
  )),
  tempo integer,
  time_signature text check (time_signature in ('4/4','3/4','2/4','6/8','12/8')),
  content text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_charts_updated_at
  before update on public.charts
  for each row execute procedure public.set_updated_at();

alter table public.charts enable row level security;

create policy "Any authenticated user can view charts"
  on public.charts for select
  to authenticated
  using (true);

create policy "Authenticated users can create their own charts"
  on public.charts for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their charts; admins can update ownerless charts"
  on public.charts for update
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      owner_id is null
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

create or replace function public.search_charts(search_term text)
returns setof public.charts
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.charts
  where deleted_at is null
    and (
      search_term = ''
      or title ilike '%' || search_term || '%'
      or exists (
        select 1 from unnest(artists) as artist
        where artist ilike '%' || search_term || '%'
      )
    )
  order by title asc;
$$;

grant execute on function public.search_charts(text) to authenticated;
