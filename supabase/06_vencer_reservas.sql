-- =====================================================================
-- VECI · Vencimiento automático de reservas (2026-10-23)
-- Cada hora, en el minuto 5, pasa a "vencida" toda reserva pendiente o con
-- alternativas ofrecidas que tenga más de 24 horas sin respuesta.
-- No toca stock: las pendientes todavía no lo habían descontado.
--
-- Ver las corridas: select * from cron.job_run_details order by start_time desc;
-- Desactivar:       select cron.unschedule('vencer-reservas');
-- =====================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'vencer-reservas',
  '5 * * * *',
  $$select public.vencer_reservas(24)$$
);
