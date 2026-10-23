-- =====================================================================
-- VECI · Vencimiento automático de reservas
-- Cada 10 minutos pasa a "vencida" toda reserva que lleve 2 horas sin
-- respuesta, contando SOLO el tiempo con el local abierto (hora argentina):
--   - pendiente: desde que se hizo la reserva;
--   - con alternativas ofrecidas: desde que el comercio las ofreció.
-- Si el comercio no cargó horario, cuenta todo el tiempo.
-- (2026-10-23: primero eran 24 h corridas; después 2 h corridas; ahora 2 h
-- de horario de atención.) No toca stock: las pendientes no lo descontaron.
--
-- Ver las corridas: select * from cron.job_run_details order by start_time desc;
-- Desactivar:       select cron.unschedule('vencer-reservas');
-- =====================================================================
create extension if not exists pg_cron;

-- Minutos entre p_desde y p_hasta con el local abierto, en hora argentina.
-- Si cierra después de medianoche (cierra <= abre), la franja sigue al día siguiente.
create or replace function public.minutos_abierto(p_desde timestamptz, p_hasta timestamptz, p_abre time, p_cierra time)
returns numeric
language sql stable set search_path = ''
as $$
  select case
    when p_hasta <= p_desde then 0
    when p_abre is null or p_cierra is null then extract(epoch from (p_hasta - p_desde)) / 60
    else coalesce((
      select sum(greatest(0, extract(epoch from (least(v.fin, t.h) - greatest(v.ini, t.d))) / 60))
      from (select p_desde at time zone 'America/Argentina/Buenos_Aires' as d,
                   p_hasta at time zone 'America/Argentina/Buenos_Aires' as h) t
      cross join lateral (
        select g::date + p_abre as ini,
               case when p_cierra > p_abre then g::date + p_cierra else (g::date + 1) + p_cierra end as fin
        from generate_series((t.d::date - 1)::timestamp, t.h::date::timestamp, interval '1 day') g
      ) v
    ), 0)
  end
$$;

create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  update public.reservas r
  set estado = 'vencida', actualizada_en = now()
  from public.comercios c
  where c.id = r.comercio_id
    and r.estado in ('pendiente', 'alternativa')
    and public.minutos_abierto(
          case when r.estado = 'alternativa' then r.actualizada_en else r.creada_en end,
          now(), c.abre, c.cierra
        ) >= p_horas * 60;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;

select cron.schedule('vencer-reservas', '*/10 * * * *', $$select public.vencer_reservas(2)$$);
