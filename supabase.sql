-- Working Out With Friends — gedeelde opslag in Supabase.
-- Plak dit in Supabase → SQL Editor → Run. Pas eerst het wachtwoord aan bij stap 2.
--
-- WAAROM DEZE OPZET
--
-- De publishable key staat in een statische site en is dus per definitie openbaar.
-- Daarom krijgt wowf_state RLS *zonder ook maar één policy*: via de API kan niemand
-- de tabel lezen of schrijven. Alle toegang loopt via twee SECURITY DEFINER functies
-- die eerst het groepswachtwoord controleren. Dat wachtwoord staat als bcrypt-hash in
-- een even goed afgeschermde tabel, dus zelfs met databasetoegang lees je het niet af.
-- Bcrypt kost ~60 ms per poging en remt daarmee meteen brute force. Dit is de
-- eenvoudigste opzet die echt veilig is: geen accounts, geen JWT's, één wachtwoord.
--
-- Realtime kan niet rechtstreeks op wowf_state luisteren: Realtime stuurt de hele
-- rij mee en checkt RLS namens anon, dus daarvoor zou je een SELECT-policy moeten
-- toevoegen — en dan is het wachtwoord waardeloos. Daarom is er een tweede tabel
-- wowf_pulse met alleen een tijdstempel erin. Een trigger tikt die aan bij elke
-- wijziging, iedereen mag hem lezen, en de app haalt na zo'n tik de echte data op met
-- wowf_pull (dus mét wachtwoord). Over het realtime-kanaal gaat geen enkel
-- trainingsgegeven — alleen "er is iets veranderd".

-- ---------------------------------------------------------------- 1. de tabel
create table if not exists public.wowf_state (
  id         text primary key,
  doc        jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wowf_state enable row level security;
-- bewust geen policies: anon en authenticated komen er via de API niet in.
revoke all on table public.wowf_state from anon, authenticated;

-- ------------------------------------------------- 2. het groepswachtwoord
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.wowf_secret (
  id        text primary key,
  pass_hash text not null
);

alter table public.wowf_secret enable row level security;
revoke all on table public.wowf_secret from anon, authenticated;

-- >>> VERVANG 'kies-hier-een-groepswachtwoord' door jullie eigen wachtwoord <<<
insert into public.wowf_secret (id, pass_hash)
values ('wowf', extensions.crypt('kies-hier-een-groepswachtwoord', extensions.gen_salt('bf', 10)))
on conflict (id) do update set pass_hash = excluded.pass_hash;

-- ------------------------------------------------------------ 3. de functies
-- Niet van buitenaf aanroepbaar; alleen wowf_pull/wowf_push gebruiken hem.
create or replace function public.wowf_is_valid(p_id text, p_pass text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.wowf_secret s
    where s.id = p_id and s.pass_hash = extensions.crypt(p_pass, s.pass_hash)
  );
$$;

revoke all on function public.wowf_is_valid(text, text) from public, anon, authenticated;

-- Ophalen. Geeft nul rijen terug zolang er nog niets is opgeslagen.
create or replace function public.wowf_pull(p_id text, p_pass text)
returns table (doc jsonb, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.wowf_is_valid(p_id, p_pass) then
    raise exception 'groepswachtwoord onjuist' using errcode = '28000';
  end if;
  return query
    select s.doc, s.updated_at from public.wowf_state s where s.id = p_id;
end;
$$;

-- Wegschrijven. Geeft de nieuwe updated_at terug.
create or replace function public.wowf_push(p_id text, p_pass text, p_doc jsonb)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare ts timestamptz;
begin
  if not public.wowf_is_valid(p_id, p_pass) then
    raise exception 'groepswachtwoord onjuist' using errcode = '28000';
  end if;
  insert into public.wowf_state as w (id, doc, updated_at)
    values (p_id, p_doc, now())
  on conflict (id) do update set doc = excluded.doc, updated_at = now()
  returning w.updated_at into ts;
  return ts;
end;
$$;

revoke all on function public.wowf_pull(text, text)        from public;
revoke all on function public.wowf_push(text, text, jsonb) from public;
grant execute on function public.wowf_pull(text, text)        to anon, authenticated;
grant execute on function public.wowf_push(text, text, jsonb) to anon, authenticated;

-- --------------------------------------------------------------- 4. realtime
-- Het klopbord: bevat geen trainingsdata, alleen wanneer er voor het laatst iets
-- veranderd is en door wie (een willekeurig client-id, geen persoonsgegeven).
create table if not exists public.wowf_pulse (
  id         text primary key,
  updated_at timestamptz not null default now(),
  by_client  text
);

alter table public.wowf_pulse enable row level security;

-- Iedereen met de publishable key mag de tik zien; er valt niets uit af te leiden.
drop policy if exists "wowf_pulse leesbaar" on public.wowf_pulse;
create policy "wowf_pulse leesbaar" on public.wowf_pulse
  for select to anon, authenticated using (true);
-- Schrijven kan alleen via de trigger hieronder (security definer), niet via de API.
revoke insert, update, delete on table public.wowf_pulse from anon, authenticated;

create or replace function public.wowf_tick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wowf_pulse (id, updated_at, by_client)
    values (new.id, new.updated_at, new.doc ->> '_client')
  on conflict (id) do update
    set updated_at = excluded.updated_at, by_client = excluded.by_client;
  return new;
end;
$$;

drop trigger if exists wowf_state_tick on public.wowf_state;
create trigger wowf_state_tick
  after insert or update on public.wowf_state
  for each row execute function public.wowf_tick();

-- Realtime aanzetten. wowf_pulse is waar de app op luistert; wowf_state staat er
-- ook in zoals gevraagd, maar levert anon niets op — RLS laat die rijen (terecht)
-- niet door. De publicatie bestaat al in elk Supabase-project.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wowf_pulse') then
    alter publication supabase_realtime add table public.wowf_pulse;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wowf_state') then
    alter publication supabase_realtime add table public.wowf_state;
  end if;
end $$;

-- ------------------------------------------------------------------ 5. check
-- Deze moet falen met 'groepswachtwoord onjuist':
--   select * from public.wowf_pull('wowf', 'fout');
-- Deze geeft een lege tabel zolang de app nog niets gepusht heeft:
--   select * from public.wowf_pull('wowf', 'kies-hier-een-groepswachtwoord');
