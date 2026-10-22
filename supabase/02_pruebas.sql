-- =====================================================================
-- VECI · Pruebas de las reglas de seguridad
-- Correr DESPUÉS de 01_esquema.sql, en SQL Editor > New query > Run.
--
-- Crea 3 usuarios de prueba (un comerciante y dos compradores), recorre
-- el flujo completo y verifica que nadie pueda hacer lo que no debe.
-- Al final borra todo lo que creó.
-- Si algo falla, se corta con un error que empieza con "FALLA:" y no
-- queda guardado nada.
-- =====================================================================
begin;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'comercio@prueba.veci', '{}', '{"rol":"comerciante","nombre":"Ana Comerciante"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'laura@prueba.veci', '{}', '{"rol":"comprador","nombre":"Laura Martínez"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'pedro@prueba.veci', '{}', '{"rol":"admin","nombre":"Pedro Gómez"}', now(), now());

do $$ begin
  if (select rol from public.perfiles where id = '11111111-1111-1111-1111-111111111111') is distinct from 'comerciante' then
    raise exception 'FALLA: el comerciante no quedó con rol comerciante';
  end if;
  if (select rol from public.perfiles where id = '33333333-3333-3333-3333-333333333333') is distinct from 'comprador' then
    raise exception 'FALLA: un rol inventado no quedó como comprador';
  end if;
end $$;

-- ---------- Como comerciante (Ana) ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.comercios (zona_id, nombre, rubro, direccion, lat, lng)
values ('escobar', 'Mercería de Prueba', 'Mercería', 'San Martín 780', -34.348, -58.795);

insert into public.productos (comercio_id, nombre, precio, modo, stock)
select id, x.nombre, x.precio, 'exacto', x.stock
from public.comercios, (values ('Hilo negro', 1200, 5), ('Hilo blanco', 1300, 3), ('Agujas x10', 600, 0)) as x (nombre, precio, stock)
where comercios.nombre = 'Mercería de Prueba';

do $$
declare ok boolean := false;
begin
  begin
    update public.comercios set aprobado = true;
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: el comerciante pudo aprobar su propio comercio'; end if;
end $$;

-- ---------- Como administrador: aprobar el comercio ----------
reset role;
update public.comercios set aprobado = true where nombre = 'Mercería de Prueba';

-- ---------- Sin cuenta (visitante) ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  if (select count(*) from public.productos) <> 3 then
    raise exception 'FALLA: el visitante no ve los 3 productos del comercio aprobado';
  end if;
  if (select count(*) from public.comercios_cercanos(-34.35, -58.79, 5, 'HILÓ')) <> 1 then
    raise exception 'FALLA: la búsqueda por cercanía no encontró el comercio';
  end if;
  if (select count(*) from public.comercios_cercanos(-34.35, -58.79, 5, 'taladro')) <> 0 then
    raise exception 'FALLA: la búsqueda encontró un producto que no existe';
  end if;
  if (select count(*) from public.perfiles) <> 0 then
    raise exception 'FALLA: el visitante ve perfiles';
  end if;
end $$;

insert into public.vistas (comercio_id) select id from public.comercios where nombre = 'Mercería de Prueba';

-- ---------- Como compradora (Laura) ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare ok boolean := false;
begin
  begin
    insert into public.comercios (zona_id, nombre, rubro, direccion) values ('escobar', 'Trucho', 'x', 'x');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: una compradora pudo crear un comercio'; end if;
end $$;

-- Reserva 1: Hilo negro x2
insert into public.reservas (producto_id, cantidad, retiro, medio_pago)
select id, 2, 'Mañana, 10:00 a 12:00', 'online' from public.productos where nombre = 'Hilo negro';
-- Reserva 2: Hilo blanco x1
insert into public.reservas (producto_id, cantidad, retiro)
select id, 1, 'Hoy, 16:00 a 18:00' from public.productos where nombre = 'Hilo blanco';
-- Guardamos el número de una reserva de Laura para probar después con Pedro.
select set_config('veci.reserva_laura', (select min(id)::text from public.reservas), true);

do $$
declare ok boolean;
begin
  if (select precio_unitario from public.reservas where producto_nombre = 'Hilo negro') <> 1200 then
    raise exception 'FALLA: la reserva no tomó el precio del producto';
  end if;

  ok := false;
  begin
    insert into public.reservas (producto_id, cantidad, retiro, precio_unitario)
    select id, 1, 'Hoy', 1 from public.productos where nombre = 'Hilo negro';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: la compradora pudo poner su propio precio'; end if;

  ok := false;
  begin
    insert into public.reservas (producto_id, cantidad, retiro)
    select id, 1, 'Hoy' from public.productos where nombre = 'Agujas x10';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: se pudo reservar un producto sin stock'; end if;

  ok := false;
  begin
    perform public.aceptar_reserva((select id from public.reservas where producto_nombre = 'Hilo negro'));
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: la compradora pudo aceptar su propia reserva'; end if;

  ok := false;
  begin
    update public.reservas set estado = 'retirada';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: la compradora pudo cambiar el estado a mano'; end if;

  ok := false;
  begin
    update public.perfiles set rol = 'comerciante';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: la compradora pudo cambiarse el rol'; end if;

  update public.perfiles set telefono = '1155550000';
  if (select telefono from public.perfiles) is distinct from '1155550000' then
    raise exception 'FALLA: la compradora no pudo editar su teléfono';
  end if;
end $$;

-- ---------- Como otro comprador (Pedro) ----------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

do $$
declare ok boolean := false;
begin
  if (select count(*) from public.reservas) <> 0 then
    raise exception 'FALLA: Pedro ve reservas ajenas';
  end if;
  if (select count(*) from public.perfiles) <> 1 then
    raise exception 'FALLA: Pedro ve perfiles ajenos';
  end if;
  begin
    perform public.cancelar_reserva(current_setting('veci.reserva_laura')::bigint);
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: Pedro pudo cancelar una reserva ajena'; end if;
end $$;

-- ---------- Comerciante responde ----------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare ok boolean := false;
begin
  if (select count(*) from public.reservas) <> 2 then
    raise exception 'FALLA: el comerciante no ve las 2 reservas de su comercio';
  end if;
  if (select nombre from public.perfiles where id = '22222222-2222-2222-2222-222222222222') is distinct from 'Laura Martínez' then
    raise exception 'FALLA: el comerciante no ve el nombre de su clienta';
  end if;
  if (select count(*) from public.perfiles where id = '33333333-3333-3333-3333-333333333333') <> 0 then
    raise exception 'FALLA: el comerciante ve a alguien que no le reservó';
  end if;

  perform public.aceptar_reserva((select id from public.reservas where producto_nombre = 'Hilo negro'));
  if (select stock from public.productos where nombre = 'Hilo negro') <> 3 then
    raise exception 'FALLA: aceptar no descontó el stock';
  end if;
  perform public.marcar_retirada((select id from public.reservas where producto_nombre = 'Hilo negro'));

  begin
    perform public.ofrecer_alternativas(
      (select id from public.reservas where producto_nombre = 'Hilo blanco'),
      array(select id from public.productos where nombre = 'Agujas x10'));
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: se pudo ofrecer una alternativa sin stock'; end if;

  perform public.ofrecer_alternativas(
    (select id from public.reservas where producto_nombre = 'Hilo blanco'),
    array(select id from public.productos where nombre = 'Hilo negro'));
end $$;

-- ---------- Compradora elige alternativa y reseña ----------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare ok boolean := false;
begin
  if (select count(*) from public.reserva_alternativas) <> 1 then
    raise exception 'FALLA: la compradora no ve la alternativa ofrecida';
  end if;
  perform public.elegir_alternativa(
    (select id from public.reservas where producto_nombre = 'Hilo blanco'),
    (select producto_id from public.reserva_alternativas limit 1));
  if (select count(*) from public.reservas where producto_nombre = 'Hilo negro' and estado = 'aceptada') <> 1 then
    raise exception 'FALLA: elegir la alternativa no cambió la reserva';
  end if;

  insert into public.resenas (reserva_id, estrellas, texto)
  select id, 5, 'Excelente atención' from public.reservas where estado = 'retirada';
  if (select autor_nombre from public.resenas) is distinct from 'Laura M.' then
    raise exception 'FALLA: la reseña no muestra "Laura M."';
  end if;

  begin
    insert into public.resenas (reserva_id, estrellas)
    select id, 1 from public.reservas where estado = 'aceptada';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: se pudo reseñar una reserva no retirada'; end if;

  ok := false;
  begin
    perform public.estadisticas_comercio((select id from public.comercios limit 1));
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: la compradora vio las estadísticas del comercio'; end if;
end $$;

-- ---------- Estadísticas del comerciante ----------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare e record;
begin
  select * into e from public.estadisticas_comercio((select id from public.comercios where nombre = 'Mercería de Prueba'));
  if e.total_vistas <> 1 or e.total_reservas <> 2 or e.total_retiradas <> 1 or e.promedio_estrellas <> 5 then
    raise exception 'FALLA: estadísticas incorrectas: %', e;
  end if;
end $$;

-- ---------- Limpieza ----------
reset role;
delete from auth.users where email like '%@prueba.veci';
commit;

select 'Todas las pruebas pasaron. No quedó ningún dato de prueba guardado.' as resultado;
