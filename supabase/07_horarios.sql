-- =====================================================================
-- VECI · Horario de atención por día de la semana (2026-10-23)
-- Cada comercio carga sus franjas por día (0 = domingo … 6 = sábado).
-- Puede tener dos franjas el mismo día (por ejemplo 9 a 13 y 16 a 20).
-- Un día sin franjas es un día cerrado.
-- Las 2 horas para responder una reserva cuentan solo dentro de estas
-- franjas: si se reserva con el local cerrado, empiezan cuando abre.
-- Reemplaza las columnas comercios.abre / comercios.cierra.
-- =====================================================================

create table public.horarios (
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  dia smallint not null check (dia between 0 and 6),
  abre time not null,
  cierra time not null check (cierra <> abre), -- cierra < abre = cierra pasada la medianoche
  primary key (comercio_id, dia, abre)
);

alter table public.horarios enable row level security;

create policy "horarios: ver de comercios aprobados o propios" on public.horarios
  for select to anon, authenticated
  using (
    exists (select 1 from public.comercios c where c.id = comercio_id and c.aprobado)
    or public.es_dueno(comercio_id)
  );
create policy "horarios: el dueño los carga" on public.horarios
  for insert to authenticated with check (public.es_dueno(comercio_id));
create policy "horarios: el dueño los cambia" on public.horarios
  for update to authenticated using (public.es_dueno(comercio_id)) with check (public.es_dueno(comercio_id));
create policy "horarios: el dueño los borra" on public.horarios
  for delete to authenticated using (public.es_dueno(comercio_id));

-- Los comercios que ya tenían horario pasan a abrir los 7 días con ese horario.
insert into public.horarios (comercio_id, dia, abre, cierra)
select c.id, d, c.abre, c.cierra
from public.comercios c cross join generate_series(0, 6) d
where c.abre is not null and c.cierra is not null and c.abre <> c.cierra;

-- Minutos entre p_desde y p_hasta con el comercio abierto, en hora
-- argentina. Si el comercio no cargó horario, cuenta todo el tiempo.
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
    ), 0)
  end
$$;

drop function public.minutos_abierto(timestamptz, timestamptz, time, time);
revoke execute on function public.minutos_abierto(bigint, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  -- Pendientes: desde la reserva. Con alternativas: desde la oferta.
  update public.reservas r
  set estado = 'vencida', actualizada_en = now()
  where r.estado in ('pendiente', 'alternativa')
    and public.minutos_abierto(
          r.comercio_id,
          case when r.estado = 'alternativa' then r.actualizada_en else r.creada_en end,
          now()
        ) >= p_horas * 60;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;

-- comercios_cercanos ya no devuelve abre/cierra (el horario está en horarios).
drop function public.comercios_cercanos(double precision, double precision, double precision, text);
create function public.comercios_cercanos(
  p_lat double precision,
  p_lng double precision,
  p_radio_km double precision default 5,
  p_busqueda text default null
)
returns table (
  id bigint,
  nombre text,
  rubro text,
  direccion text,
  zona_id text,
  lat double precision,
  lng double precision,
  whatsapp text,
  distancia_km double precision
)
language sql stable set search_path = ''
as $$
  select t.*
  from (
    select c.id, c.nombre, c.rubro, c.direccion, c.zona_id, c.lat, c.lng, c.whatsapp,
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians(c.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(c.lat)) * power(sin(radians(c.lng - p_lng) / 2), 2)
      ))) as distancia_km
    from public.comercios c
    where c.aprobado
      and c.lat is not null and c.lng is not null
      and (
        coalesce(trim(p_busqueda), '') = ''
        or extensions.unaccent(c.nombre || ' ' || c.rubro) ilike '%' || extensions.unaccent(trim(p_busqueda)) || '%'
        or exists (
          select 1 from public.productos p
          where p.comercio_id = c.id and p.activo
            and extensions.unaccent(p.nombre || ' ' || coalesce(p.marca, '')) ilike '%' || extensions.unaccent(trim(p_busqueda)) || '%'
        )
      )
  ) t
  where t.distancia_km <= p_radio_km
  order by t.distancia_km;
$$;

-- Se corrió después de publicar la app nueva (la vieja todavía las usaba):
alter table public.comercios drop column abre, drop column cierra;
