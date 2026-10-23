-- =====================================================================
-- VECI · Vencimiento automático de reservas
-- Cada 10 minutos pasa a "vencida" toda reserva pendiente o con
-- alternativas ofrecidas que tenga más de 2 horas sin respuesta.
-- (2026-10-23: primero eran 24 h cada hora; se bajó a 2 h.)
-- No toca stock: las pendientes todavía no lo habían descontado.
--
-- Ver las corridas: select * from cron.job_run_details order by start_time desc;
-- Desactivar:       select cron.unschedule('vencer-reservas');
-- =====================================================================
create extension if not exists pg_cron;

create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  update public.reservas
  set estado = 'vencida', actualizada_en = now()
  where estado in ('pendiente', 'alternativa')
    and creada_en < now() - make_interval(hours => p_horas);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;

select cron.schedule('vencer-reservas', '*/10 * * * *', $$select public.vencer_reservas(2)$$);
