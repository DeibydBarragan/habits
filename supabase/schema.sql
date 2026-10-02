-- habits · esquema Supabase
-- Ejecuta esto en Supabase > SQL Editor

-- 1. Perfiles (1 por usuario)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

-- 2. Categorías de hábitos
create table if not exists public.habit_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'other',
  color text not null default '#64748B',
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- 3. Hábitos
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('build','avoid')),
  category_id uuid references public.habit_categories(id) on delete set null,
  color text not null default '#64748B',
  days_active smallint[] not null default '{1,2,3,4,5,6,7}',
  next_habit_id uuid references public.habits(id) on delete set null,
  tracking_mode text not null default 'check' check (tracking_mode in ('check','count')),
  target_count int null check (target_count is null or target_count > 0),
  unit text null,
  counters jsonb null default '[]'::jsonb,
  chain_name text null,
  chain_time text null,
  archived boolean not null default false,
  created_at timestamptz default now(),
  check (next_habit_id is null or next_habit_id <> id)
);

create index if not exists habits_user_idx on public.habits(user_id, archived);

-- 4. Logs diarios (uno por hábito+día)
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  status text not null check (status in ('done','missed')),
  count int null check (count is null or count >= 0),
  counts jsonb null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(habit_id, date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, date desc);
create index if not exists habit_logs_habit_date_idx on public.habit_logs(habit_id, date desc);

-- 5. RLS
alter table public.profiles enable row level security;
alter table public.habit_categories enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own habit_categories" on public.habit_categories;
create policy "own habit_categories" on public.habit_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own habit_logs" on public.habit_logs;
create policy "own habit_logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Evitar ciclos en encadenamiento A->B->A
create or replace function public.prevent_habit_cycle()
returns trigger language plpgsql as $$
declare
  cur uuid;
  depth int := 0;
begin
  if new.next_habit_id is null then return new; end if;
  if new.next_habit_id = new.id then
    raise exception 'cycle: self reference';
  end if;
  cur := new.next_habit_id;
  while cur is not null and depth < 50 loop
    if cur = new.id then
      raise exception 'cycle: chain returns to habit';
    end if;
    select next_habit_id into cur from public.habits where id = cur;
    depth := depth + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists habits_no_cycle on public.habits;
create trigger habits_no_cycle
  before insert or update of next_habit_id on public.habits
  for each row execute procedure public.prevent_habit_cycle();

-- 7. Perfil + categorías semilla al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  chosen_name text := coalesce((new.raw_user_meta_data ->> 'name'), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, name)
  values (new.id, chosen_name)
  on conflict (id) do nothing;

  insert into public.habit_categories (user_id, name, icon, color) values
    (new.id, 'Salud', 'health', '#16A34A'),
    (new.id, 'Casa', 'home', '#9333EA'),
    (new.id, 'Mente', 'reading', '#2563EB'),
    (new.id, 'Deporte', 'sport', '#F97316'),
    (new.id, 'Vicios', 'other', '#EF4444')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. Borrado de cuenta por el propio usuario
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
