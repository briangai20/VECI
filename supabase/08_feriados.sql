-- =====================================================================
-- VECI · Feriados y cierres puntuales (2026-10-23)
-- - feriados: nacionales (fuente: api.argentinadatos.com). Hay que sumar
--   cada año nuevo, y los que decrete el gobierno durante el año.
--   Los "puente" (no laborables) no cierran el comercio; solo cuentan los
--   inamovibles y los trasladables.
-- - comercios.abre_feriados: si el comercio abre los feriados (por defecto, no).
-- - cierres: días que el comercio cierra por su cuenta (vacaciones, inventario).
-- Las 2 horas para responder no corren en un día cerrado.
-- =====================================================================

create table public.feriados (
  fecha date primary key,
  nombre text not null,
  tipo text not null check (tipo in ('inamovible', 'trasladable', 'puente'))
);
alter table public.feriados enable row level security;
create policy "feriados: ver" on public.feriados for select to anon, authenticated using (true);

alter table public.comercios add column abre_feriados boolean not null default false;
grant insert (abre_feriados), update (abre_feriados) on public.comercios to authenticated;

create table public.cierres (
  id bigint generated always as identity primary key,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  desde date not null,
  hasta date not null check (hasta >= desde),
  motivo text check (length(motivo) <= 80)
);
create index on public.cierres (comercio_id, hasta);
alter table public.cierres enable row level security;
create policy "cierres: ver de comercios aprobados o propios" on public.cierres
  for select to anon, authenticated
  using (exists (select 1 from public.comercios c where c.id = comercio_id and c.aprobado) or public.es_dueno(comercio_id));
create policy "cierres: el dueño los carga" on public.cierres
  for insert to authenticated with check (public.es_dueno(comercio_id));
create policy "cierres: el dueño los borra" on public.cierres
  for delete to authenticated using (public.es_dueno(comercio_id));

-- Días cerrados de un comercio entre dos fechas, con el motivo (para la app).
create or replace function public.dias_cerrados(p_comercio bigint, p_desde date, p_hasta date)
returns table (fecha date, motivo text)
language sql stable set search_path = ''
as $$
  select g::date, coalesce(
    (select coalesce(ci.motivo, 'Cerrado') from public.cierres ci
      where ci.comercio_id = p_comercio and g::date between ci.desde and ci.hasta limit 1),
    (select 'Feriado: ' || f.nombre from public.feriados f
      where f.fecha = g::date and f.tipo <> 'puente'
        and not (select c.abre_feriados from public.comercios c where c.id = p_comercio))
  )
  from generate_series(p_desde, p_hasta, interval '1 day') g
  where exists (select 1 from public.cierres ci where ci.comercio_id = p_comercio and g::date between ci.desde and ci.hasta)
     or (exists (select 1 from public.feriados f where f.fecha = g::date and f.tipo <> 'puente')
         and not (select c.abre_feriados from public.comercios c where c.id = p_comercio))
$$;

-- Igual que antes, pero sin contar los días cerrados (feriados y cierres).
create or replace function public.minutos_abierto(p_comercio bigint, p_desde timestamptz, p_hasta timestamptz)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case
    when p_hasta <= p_desde then 0
    when not exists (select 1 from public.horarios where comercio_id = p_comercio)
      then extract(epoch from (p_hasta - p_desde)) / 60
    else coalesce((
      select sum(greatest(0, extract(epoch from (
               least(case when hr.cierra > hr.abre then g::date + hr.cierra else (g::date + 1) + hr.cierra end, t.h)
               - greatest(g::date + hr.abre, t.d))) / 60))
      from (select p_desde at time zone 'America/Argentina/Buenos_Aires' as d,
                   p_hasta at time zone 'America/Argentina/Buenos_Aires' as h) t
      cross join generate_series((t.d::date - 1)::timestamp, t.h::date::timestamp, interval '1 day') g
      join public.horarios hr on hr.comercio_id = p_comercio and hr.dia = extract(dow from g)
      where g::date not in (select x.fecha from public.dias_cerrados(p_comercio, (t.d::date - 1), t.h::date) x)
    ), 0)
  end
$$;
revoke execute on function public.minutos_abierto(bigint, timestamptz, timestamptz) from public, anon, authenticated;

insert into public.feriados (fecha, tipo, nombre) values
  ('2026-01-01', 'inamovible', 'Año nuevo'),
  ('2026-02-16', 'inamovible', 'Carnaval'),
  ('2026-02-17', 'inamovible', 'Carnaval'),
  ('2026-03-23', 'puente', 'Puente turístico no laborable'),
  ('2026-03-24', 'inamovible', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
  ('2026-04-02', 'inamovible', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
  ('2026-04-03', 'inamovible', 'Viernes Santo'),
  ('2026-05-01', 'inamovible', 'Día del Trabajador'),
  ('2026-05-25', 'inamovible', 'Día de la Revolución de Mayo'),
  ('2026-06-15', 'trasladable', 'Paso a la Inmortalidad del General Martín Güemes (17/6)'),
  ('2026-06-20', 'inamovible', 'Paso a la Inmortalidad del General Manuel Belgrano'),
  ('2026-07-09', 'inamovible', 'Día de la Independencia'),
  ('2026-07-10', 'puente', 'Puente turístico no laborable'),
  ('2026-08-17', 'trasladable', 'Paso a la Inmortalidad del Gral. José de San Martín'),
  ('2026-10-12', 'trasladable', 'Día del Respeto a la Diversidad Cultural'),
  ('2026-11-09', 'inamovible', 'Visita del papa León XIV'),
  ('2026-11-23', 'trasladable', 'Día de la Soberanía Nacional (20/11)'),
  ('2026-12-07', 'puente', 'Puente turístico no laborable'),
  ('2026-12-08', 'inamovible', 'Día de la Inmaculada Concepción de María'),
  ('2026-12-25', 'inamovible', 'Navidad'),
  ('2027-01-01', 'inamovible', 'Año nuevo'),
  ('2027-02-08', 'inamovible', 'Carnaval'),
  ('2027-02-09', 'inamovible', 'Carnaval'),
  ('2027-03-24', 'inamovible', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
  ('2027-03-26', 'inamovible', 'Viernes Santo'),
  ('2027-04-02', 'inamovible', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
  ('2027-05-01', 'inamovible', 'Día del Trabajador'),
  ('2027-05-25', 'inamovible', 'Día de la Revolución de Mayo'),
  ('2027-06-17', 'trasladable', 'Paso a la Inmortalidad del General Martín Güemes'),
  ('2027-06-20', 'inamovible', 'Paso a la Inmortalidad del General Manuel Belgrano'),
  ('2027-07-09', 'inamovible', 'Día de la Independencia'),
  ('2027-08-17', 'trasladable', 'Paso a la Inmortalidad del Gral. José de San Martín'),
  ('2027-10-12', 'trasladable', 'Día del Respeto a la Diversidad Cultural'),
  ('2027-11-20', 'trasladable', 'Día de la Soberanía Nacional'),
  ('2027-12-08', 'inamovible', 'Día de la Inmaculada Concepción de María'),
  ('2027-12-25', 'inamovible', 'Navidad');
