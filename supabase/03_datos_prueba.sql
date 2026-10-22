-- =====================================================================
-- VECI · Datos de prueba (los comercios y productos del prototipo)
--
-- Crea 6 comerciantes y 5 compradores de mentira (mails @demo.veci.test,
-- sin contraseña: no se puede entrar con ellos), sus comercios aprobados,
-- productos y 5 reseñas. Las reservas de las reseñas pasan por las mismas
-- funciones que va a usar la app, así de paso se prueban.
--
-- Para borrarlos: 04_borrar_datos_prueba.sql
-- Los WhatsApp quedan vacíos a propósito, para no mandar mensajes a
-- números reales. Las coordenadas son aproximadas.
-- =====================================================================

do $$
declare
  imgm constant text := 'https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?w=800&q=80&auto=format&fit=crop';
  imgf constant text := 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80&auto=format&fit=crop';
  imgh constant text := 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80&auto=format&fit=crop';
  c1 bigint; c2 bigint; c3 bigint; c4 bigint; c5 bigint; c6 bigint;
  r record;
  v_reserva bigint;
begin
  if exists (select 1 from auth.users where email like '%@demo.veci.test') then
    raise exception 'Los datos de prueba ya están cargados. Borralos antes con 04_borrar_datos_prueba.sql';
  end if;

  -- Usuarios de prueba. El perfil lo crea solo el trigger al_crear_usuario.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, '', now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('rol', u.rol, 'nombre', u.nombre), now(), now(),
    '', '', '', ''
  from (values
    ('de300000-0000-4000-8000-000000000001', 'aguja@demo.veci.test',     'comerciante', 'Mercería La Aguja'),
    ('de300000-0000-4000-8000-000000000002', 'tornillo@demo.veci.test',  'comerciante', 'Ferretería El Tornillo'),
    ('de300000-0000-4000-8000-000000000003', 'solido@demo.veci.test',    'comerciante', 'Solido herrajes'),
    ('de300000-0000-4000-8000-000000000004', 'mpacheco@demo.veci.test',  'comerciante', 'Mercería Pacheco'),
    ('de300000-0000-4000-8000-000000000005', 'rueda@demo.veci.test',     'comerciante', 'Ferretería La Rueda'),
    ('de300000-0000-4000-8000-000000000006', 'delta@demo.veci.test',     'comerciante', 'Herrajes del Delta'),
    ('de300000-0000-4000-8000-000000000101', 'marta@demo.veci.test',     'comprador',   'Marta Rodríguez'),
    ('de300000-0000-4000-8000-000000000102', 'julian@demo.veci.test',    'comprador',   'Julián Pérez'),
    ('de300000-0000-4000-8000-000000000103', 'sofia@demo.veci.test',     'comprador',   'Sofía Torres'),
    ('de300000-0000-4000-8000-000000000104', 'diego@demo.veci.test',     'comprador',   'Diego López'),
    ('de300000-0000-4000-8000-000000000105', 'carla@demo.veci.test',     'comprador',   'Carla Sosa')
  ) as u (id, email, rol, nombre);

  -- Comercios
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000001', 'escobar', 'Mercería La Aguja', 'Mercería', 'San Martín 780, Belén de Escobar', -34.34612, -58.80176, '09:00', '20:00', true)
  returning id into c1;
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000002', 'escobar', 'Ferretería El Tornillo', 'Ferretería', 'Av. Ricardo Balbín 1040, Belén de Escobar', -34.35300, -58.78299, '08:00', '18:00', true)
  returning id into c2;
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000003', 'escobar', 'Solido herrajes', 'Herrajes', 'Rivadavia 1450, Belén de Escobar', -34.36390, -58.80400, '08:00', '18:00', true)
  returning id into c3;
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000004', 'pacheco', 'Mercería Pacheco', 'Mercería', 'Av. Cazón 2315, Pacheco', -34.44964, -58.65034, '09:00', '19:00', true)
  returning id into c4;
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000005', 'pacheco', 'Ferretería La Rueda', 'Ferretería', 'Ruta 27 Km 3, Pacheco', -34.44381, -58.64048, '08:00', '18:00', true)
  returning id into c5;
  insert into public.comercios (dueno_id, zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, aprobado)
  values ('de300000-0000-4000-8000-000000000006', 'tigre', 'Herrajes del Delta', 'Herrajes', 'Lavalle 220, Tigre', -34.43678, -58.60233, '08:00', '18:00', true)
  returning id into c6;

  -- Productos
  insert into public.productos (comercio_id, nombre, marca, grupo, descripcion, precio, modo, stock, semaforo, foto_url, actualizado_en)
  values
    (c1, 'Hilo de coser negro', null, null, 'Poliéster de alta resistencia para costuras diarias.', 1200, 'exacto', 12, null, imgm, now()),
    (c1, 'Botones 15 mm x12', null, null, 'Botones de resina con cuatro agujeros, color negro.', 850, 'exacto', 2, null, imgm, now()),
    (c1, 'Cierre 20 cm', null, null, 'Cierre de nylon con cursor metálico.', 850, 'exacto', 8, null, imgm, now()),
    (c1, 'Agujas de coser x10', null, null, 'Surtido de agujas para tela con punta redonda.', 600, 'exacto', 0, null, imgm, now()),

    (c2, 'Tornillos 4x40 (x100)', null, null, 'Acero galvanizado para madera y tarugos plásticos.', 2300, 'exacto', 20, null, imgf, now()),
    (c2, 'Cinta aisladora 20 m', null, null, 'Cinta de PVC resistente al calor y a la humedad.', 1100, 'exacto', 9, null, imgf, now()),
    -- Sin actualizar hace 10 días: se ve "Sin verificar".
    (c2, 'Martillo 500 g', null, null, 'Mango de fibra de vidrio y cabeza de acero forjado.', 8900, 'exacto', 2, null, imgf, now() - interval '10 days'),
    (c2, 'Taladro Bosch GSB 500 W', 'Bosch', 'Taladro percutor', 'Taladro percutor de 500 W con mandril de 13 mm.', 98000, 'exacto', 4, null, imgf, now()),
    (c2, 'Taladro Makita HP 600 W', 'Makita', 'Taladro percutor', 'Taladro percutor de 600 W con velocidad variable.', 112000, 'exacto', 0, null, imgf, now()),
    (c2, 'Taladro Black+Decker 550 W', 'Black+Decker', 'Taladro percutor', 'Taladro de 550 W, pensado para uso doméstico.', 89000, 'semaforo', null, 'poco', imgf, now()),
    (c2, 'Tornillo autoperforante 4.2 x 32 (x100)', 'Acero zincado', 'Tornillo autoperforante', 'Caja de 100 tornillos para chapa.', null, 'consultar', null, null, imgf, now()),
    (c2, 'Tornillo autoperforante 4.8 x 50 (x100)', 'Acero zincado', 'Tornillo autoperforante', 'Medida para trabajos pesados. Se prepara bajo pedido.', 3100, 'pedido', null, null, imgf, now()),

    (c3, 'Corredera pesada 35 cm', null, null, 'Corredera de extensión total con carga de hasta 35 kg.', 9800, 'exacto', 6, null, imgh, now()),
    (c3, 'Corredera de cajón 35 cm', null, null, 'Corredera telescópica con cierre suave.', 4200, 'exacto', 4, null, imgh, now()),
    (c3, 'Bisagra cazoleta 0', null, null, 'Bisagra de cazoleta con cierre a presión.', 650, 'exacto', 0, null, imgh, now()),
    (c3, 'Cerradura Prive 200', null, null, 'Cerradura de embutir con llave de seguridad.', null, 'exacto', 5, null, imgh, now()),
    (c3, 'Placa MDF blanco 18 mm 2440x1220', null, null, 'Placa de MDF blanca, medida estándar.', 62000, 'exacto', 3, null, imgh, now()),

    (c4, 'Hilo de coser blanco', null, null, 'Hilo de algodón para ropa y ropa de hogar.', 1300, 'exacto', 10, null, imgm, now()),
    (c4, 'Botones 15 mm x12', null, null, 'Botones lisos de resina, varios colores.', 900, 'exacto', 15, null, imgm, now()),
    (c4, 'Agujas de coser x10', null, null, 'Agujas de punta fina para telas livianas.', 650, 'exacto', 1, null, imgm, now()),

    (c5, 'Tornillos 4x40 (x100)', null, null, 'Caja de tornillos de acero para uso general.', 2400, 'exacto', 14, null, imgf, now()),
    (c5, 'Cinta aisladora 20 m', null, null, 'Cinta aislante para uso eléctrico doméstico.', 1150, 'exacto', 7, null, imgf, now()),
    (c5, 'Llave de paso 1/2', null, null, 'Llave de paso de bronce con maneral de palanca.', 3900, 'exacto', 0, null, imgf, now()),

    (c6, 'Corredera pesada 35 cm', null, null, 'Corredera de extensión total para cajones grandes.', 9900, 'exacto', 4, null, imgh, now()),
    (c6, 'Bisagra cazoleta 9', null, null, 'Bisagra de cazoleta con recorte de 9 mm.', 680, 'exacto', 0, null, imgh, now()),
    (c6, 'Cerradura Prive 200', null, null, 'Cerradura de seguridad con cilindro de 200 mm.', 5950, 'exacto', 6, null, imgh, now());

  -- Reseñas: cada una necesita una reserva retirada. Se hace como en la app:
  -- el comprador reserva, el comerciante acepta y marca retirada, y el
  -- comprador deja la reseña. request.jwt.claims hace de "sesión".
  for r in
    select * from (values
      ('de300000-0000-4000-8000-000000000101'::uuid, c1, 'Hilo de coser negro',   5, 'Tenían todo lo que necesitaba y me atendieron rápido.',       '2026-10-08'::date),
      ('de300000-0000-4000-8000-000000000102'::uuid, c1, 'Cierre 20 cm',          4, 'Buena atención. El hilo estaba como decía la app.',           '2026-10-03'::date),
      ('de300000-0000-4000-8000-000000000103'::uuid, c1, 'Hilo de coser negro',   5, 'Reservé por la noche y al otro día todo listo para retirar.', '2026-09-29'::date),
      ('de300000-0000-4000-8000-000000000104'::uuid, c3, 'Corredera pesada 35 cm', 5, 'Retiré las correderas sin esperar. Muy prolijos.',          '2026-10-06'::date),
      ('de300000-0000-4000-8000-000000000105'::uuid, c2, 'Tornillos 4x40 (x100)', 3, 'Conviene ir con tiempo: hubo que esperar en el mostrador.',  '2026-10-01'::date)
    ) as t (comprador, comercio, producto, estrellas, texto, fecha)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.comprador, 'role', 'authenticated')::text, true);
    insert into public.reservas (producto_id, cantidad, retiro, medio_pago)
    select id, 1, 'Mañana, 10:00 a 12:00', 'local'
    from public.productos where comercio_id = r.comercio and nombre = r.producto
    returning id into v_reserva;

    perform set_config('request.jwt.claims',
      json_build_object('sub', (select dueno_id from public.comercios where id = r.comercio), 'role', 'authenticated')::text, true);
    perform public.aceptar_reserva(v_reserva);
    perform public.marcar_retirada(v_reserva);

    perform set_config('request.jwt.claims', json_build_object('sub', r.comprador, 'role', 'authenticated')::text, true);
    insert into public.resenas (reserva_id, estrellas, texto) values (v_reserva, r.estrellas, r.texto);

    -- Fechas del prototipo
    update public.reservas set creada_en = r.fecha - 1, actualizada_en = r.fecha where id = v_reserva;
    update public.resenas set creada_en = r.fecha + time '18:00' where reserva_id = v_reserva;
  end loop;

  perform set_config('request.jwt.claims', '', true);
end;
$$;
