-- =====================================================================
-- VECI · Esquema inicial (paso 2 del plan)
-- Cuentas (comprador / comerciante), tablas y reglas de seguridad.
--
-- Cómo usarlo: en Supabase, SQL Editor > New query > pegar todo > Run.
-- Se corre una sola vez, sobre un proyecto vacío.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('comprador', 'comerciante');
create type public.modo_stock as enum ('exacto', 'semaforo', 'consultar', 'pedido');
create type public.semaforo as enum ('hay', 'poco', 'no');
create type public.medio_pago as enum ('local', 'online');
create type public.estado_reserva as enum ('pendiente', 'alternativa', 'aceptada', 'retirada', 'rechazada', 'cancelada', 'vencida');

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Un perfil por cuenta. Se crea solo al registrarse (ver crear_perfil).
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_usuario not null default 'comprador',
  nombre text not null default '',
  telefono text,
  creado_en timestamptz not null default now()
);

create table public.zonas (
  id text primary key,
  nombre text not null,
  activa boolean not null default false
);

insert into public.zonas (id, nombre, activa) values
  ('escobar', 'Belén de Escobar', true),
  ('pacheco', 'Pacheco', false),
  ('tigre', 'Tigre', false),
  ('olivos', 'Olivos', false),
  ('urquiza', 'Villa Urquiza', false),
  ('pilar', 'Pilar', false);

-- Un comercio nuevo queda sin aprobar hasta que lo aprobás vos desde el
-- panel de Supabase (Table Editor > comercios > aprobado = true).
create table public.comercios (
  id bigint generated always as identity primary key,
  dueno_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  zona_id text not null references public.zonas (id),
  nombre text not null check (length(trim(nombre)) > 0),
  rubro text not null,
  direccion text not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  abre time,
  cierra time,
  whatsapp text,
  aprobado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index on public.comercios (dueno_id);
create index on public.comercios (zona_id) where aprobado;

create table public.productos (
  id bigint generated always as identity primary key,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  codigo text, -- código del producto en la planilla del comercio, para actualizar por Excel
  nombre text not null check (length(trim(nombre)) > 0),
  marca text,
  grupo text, -- para agrupar variantes, por ejemplo "Taladro percutor"
  descripcion text,
  precio numeric(12, 2) check (precio is null or precio >= 0), -- null = "A consultar"
  modo public.modo_stock not null default 'exacto',
  stock integer check (stock is null or stock >= 0), -- se usa con modo 'exacto'
  semaforo public.semaforo, -- se usa con modo 'semaforo'
  foto_url text,
  activo boolean not null default true,
  actualizado_en timestamptz not null default now(),
  unique (comercio_id, codigo)
);
create index on public.productos (comercio_id) where activo;

-- Precio y nombre se copian al reservar, para que la reserva no cambie
-- si después el comercio actualiza su lista.
create table public.reservas (
  id bigint generated always as identity primary key,
  comprador_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  producto_id bigint references public.productos (id) on delete set null,
  producto_original_id bigint references public.productos (id) on delete set null,
  producto_nombre text not null,
  precio_unitario numeric(12, 2),
  cantidad integer not null check (cantidad between 1 and 20),
  retiro text not null, -- horario elegido, por ejemplo "Mañana, 10:00 a 12:00"
  medio_pago public.medio_pago not null default 'local',
  estado public.estado_reserva not null default 'pendiente',
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create index on public.reservas (comprador_id);
create index on public.reservas (comercio_id, estado);

-- Productos que el comercio ofrece cuando no tiene el pedido.
create table public.reserva_alternativas (
  reserva_id bigint not null references public.reservas (id) on delete cascade,
  producto_id bigint not null references public.productos (id) on delete cascade,
  primary key (reserva_id, producto_id)
);

-- Una reseña por reserva retirada.
create table public.resenas (
  id bigint generated always as identity primary key,
  reserva_id bigint not null unique references public.reservas (id) on delete cascade,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  autor_nombre text not null, -- "Laura M."
  estrellas smallint not null check (estrellas between 1 and 5),
  texto text check (length(texto) <= 1000),
  creada_en timestamptz not null default now()
);
create index on public.resenas (comercio_id);

-- Para las estadísticas del comerciante.
create table public.vistas (
  id bigint generated always as identity primary key,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  producto_id bigint references public.productos (id) on delete cascade,
  creada_en timestamptz not null default now()
);
create index on public.vistas (comercio_id, creada_en);

-- ---------------------------------------------------------------------
-- Funciones de apoyo para las reglas
-- ---------------------------------------------------------------------
create function public.es_comerciante()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'comerciante'
  );
$$;

create function public.es_dueno(p_comercio bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comercios
    where id = p_comercio and dueno_id = (select auth.uid())
  );
$$;

-- El comerciante puede ver el nombre de quien le reservó.
create function public.es_cliente_mio(p_perfil uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.reservas r
    join public.comercios c on c.id = r.comercio_id
    where r.comprador_id = p_perfil and c.dueno_id = (select auth.uid())
  );
$$;

-- Las fotos se guardan en la carpeta "<id del comercio>/..."
create function public.es_dueno_carpeta(p_carpeta text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_carpeta is null or p_carpeta !~ '^[0-9]+$' then
    return false;
  end if;
  return public.es_dueno(p_carpeta::bigint);
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Al registrarse, el rol sale de los datos del alta: { rol: 'comerciante' }.
-- Cualquier otro valor queda como comprador.
create function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, rol, nombre, telefono)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'rol' = 'comerciante'
      then 'comerciante'::public.rol_usuario
      else 'comprador'::public.rol_usuario
    end,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    new.raw_user_meta_data ->> 'telefono'
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

create function public.tocar_producto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger al_actualizar_producto
  before update on public.productos
  for each row execute function public.tocar_producto();

-- Completa la reserva con datos del producto. El cliente solo elige
-- producto, cantidad, horario y medio de pago; el precio lo pone la base.
create function public.preparar_reserva()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  p public.productos;
begin
  select * into p from public.productos where id = new.producto_id and activo;
  if not found then
    raise exception 'El producto no existe o no está disponible';
  end if;
  if not exists (select 1 from public.comercios where id = p.comercio_id and aprobado) then
    raise exception 'El comercio no está disponible';
  end if;
  if (p.modo = 'exacto' and coalesce(p.stock, 0) < new.cantidad)
     or (p.modo = 'semaforo' and p.semaforo = 'no') then
    raise exception 'No hay stock suficiente de %', p.nombre;
  end if;
  if new.medio_pago = 'online' and p.precio is null then
    raise exception 'Este producto no tiene precio cargado: elegí pagar en el local';
  end if;

  new.comprador_id := auth.uid();
  new.comercio_id := p.comercio_id;
  new.producto_nombre := p.nombre;
  new.precio_unitario := p.precio;
  new.producto_original_id := null;
  new.estado := 'pendiente';
  new.creada_en := now();
  new.actualizada_en := now();
  return new;
end;
$$;

create trigger al_crear_reserva
  before insert on public.reservas
  for each row execute function public.preparar_reserva();

create function public.preparar_resena()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.reservas;
  partes text[];
begin
  select * into r from public.reservas where id = new.reserva_id;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Solo podés reseñar tus propias reservas';
  end if;
  if r.estado <> 'retirada' then
    raise exception 'Podés dejar la reseña después de retirar el pedido';
  end if;

  select regexp_split_to_array(trim(nombre), '\s+') into partes
  from public.perfiles where id = auth.uid();

  new.comercio_id := r.comercio_id;
  new.autor_id := auth.uid();
  new.autor_nombre := case
    when coalesce(partes[1], '') = '' then 'Cliente'
    when array_length(partes, 1) > 1 then partes[1] || ' ' || left(partes[2], 1) || '.'
    else partes[1]
  end;
  new.creada_en := now();
  return new;
end;
$$;

create trigger al_crear_resena
  before insert on public.resenas
  for each row execute function public.preparar_resena();

-- ---------------------------------------------------------------------
-- Reglas de seguridad (RLS)
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.zonas enable row level security;
alter table public.comercios enable row level security;
alter table public.productos enable row level security;
alter table public.reservas enable row level security;
alter table public.reserva_alternativas enable row level security;
alter table public.resenas enable row level security;
alter table public.vistas enable row level security;

-- Perfiles: cada uno ve y edita el suyo; el comerciante ve a sus clientes.
create policy "perfiles: ver el propio o de mis clientes" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.es_cliente_mio(id));
create policy "perfiles: editar el propio" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Zonas: las ve cualquiera.
create policy "zonas: ver" on public.zonas
  for select to anon, authenticated
  using (true);

-- Comercios: cualquiera ve los aprobados; el dueño ve y edita el suyo.
create policy "comercios: ver aprobados o propios" on public.comercios
  for select to anon, authenticated
  using (aprobado or dueno_id = (select auth.uid()));
create policy "comercios: alta solo comerciantes" on public.comercios
  for insert to authenticated
  with check (dueno_id = (select auth.uid()) and public.es_comerciante());
create policy "comercios: editar el propio" on public.comercios
  for update to authenticated
  using (dueno_id = (select auth.uid()))
  with check (dueno_id = (select auth.uid()));
create policy "comercios: borrar el propio" on public.comercios
  for delete to authenticated
  using (dueno_id = (select auth.uid()));

-- Productos: cualquiera ve los activos de comercios aprobados; el dueño
-- maneja su catálogo.
create policy "productos: ver" on public.productos
  for select to anon, authenticated
  using (
    (activo and exists (select 1 from public.comercios c where c.id = comercio_id and c.aprobado))
    or public.es_dueno(comercio_id)
  );
create policy "productos: alta del dueño" on public.productos
  for insert to authenticated
  with check (public.es_dueno(comercio_id));
create policy "productos: editar del dueño" on public.productos
  for update to authenticated
  using (public.es_dueno(comercio_id))
  with check (public.es_dueno(comercio_id));
create policy "productos: borrar del dueño" on public.productos
  for delete to authenticated
  using (public.es_dueno(comercio_id));

-- Reservas: el comprador ve las suyas y el comercio las que le llegan.
-- Los cambios de estado van por las funciones de más abajo, no por update.
create policy "reservas: ver propias o de mi comercio" on public.reservas
  for select to authenticated
  using (comprador_id = (select auth.uid()) or public.es_dueno(comercio_id));
create policy "reservas: crear propias" on public.reservas
  for insert to authenticated
  with check (comprador_id = (select auth.uid()));

create policy "alternativas: ver si veo la reserva" on public.reserva_alternativas
  for select to authenticated
  using (exists (select 1 from public.reservas r where r.id = reserva_id));

-- Reseñas: públicas; solo las escribe quien retiró.
create policy "resenas: ver" on public.resenas
  for select to anon, authenticated
  using (true);
create policy "resenas: escribir propias" on public.resenas
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

-- Vistas: cualquiera suma una; solo el dueño las ve.
create policy "vistas: registrar" on public.vistas
  for insert to anon, authenticated
  with check (exists (select 1 from public.comercios c where c.id = comercio_id and c.aprobado));
create policy "vistas: ver del dueño" on public.vistas
  for select to authenticated
  using (public.es_dueno(comercio_id));

-- Columnas que cada uno puede escribir. Así nadie se cambia el rol,
-- se aprueba el comercio solo ni toca el precio de una reserva.
revoke insert, update, delete on public.perfiles from anon, authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;

revoke insert, update on public.comercios from anon, authenticated;
grant insert (zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, whatsapp) on public.comercios to authenticated;
grant update (zona_id, nombre, rubro, direccion, lat, lng, abre, cierra, whatsapp) on public.comercios to authenticated;

revoke insert, update, delete on public.reservas from anon, authenticated;
grant insert (producto_id, cantidad, retiro, medio_pago) on public.reservas to authenticated;

revoke insert, update, delete on public.resenas from anon, authenticated;
grant insert (reserva_id, estrellas, texto) on public.resenas to authenticated;

revoke update, delete on public.vistas from anon, authenticated;

-- ---------------------------------------------------------------------
-- Stock (uso interno de las funciones de reservas)
-- ---------------------------------------------------------------------
create function public.descontar_stock(p_producto bigint, p_cantidad integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.productos;
begin
  select * into p from public.productos where id = p_producto for update;
  if not found or p.modo <> 'exacto' then
    return;
  end if;
  if coalesce(p.stock, 0) < p_cantidad then
    raise exception 'No queda stock suficiente de % (hay %)', p.nombre, coalesce(p.stock, 0);
  end if;
  update public.productos set stock = stock - p_cantidad where id = p.id;
end;
$$;

create function public.devolver_stock(p_producto bigint, p_cantidad integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.productos
  set stock = coalesce(stock, 0) + p_cantidad
  where id = p_producto and modo = 'exacto';
end;
$$;

-- ---------------------------------------------------------------------
-- Flujo de reservas
-- ---------------------------------------------------------------------

-- Comerciante: acepta (descuenta stock).
create function public.aceptar_reserva(p_reserva bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'pendiente' then
    raise exception 'La reserva ya no está pendiente (está %)', r.estado;
  end if;
  perform public.descontar_stock(r.producto_id, r.cantidad);
  update public.reservas set estado = 'aceptada', actualizada_en = now() where id = r.id;
end;
$$;

-- Comerciante: rechaza.
create function public.rechazar_reserva(p_reserva bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado not in ('pendiente', 'alternativa') then
    raise exception 'La reserva ya no se puede rechazar (está %)', r.estado;
  end if;
  delete from public.reserva_alternativas where reserva_id = r.id;
  update public.reservas set estado = 'rechazada', actualizada_en = now() where id = r.id;
end;
$$;

-- Comerciante: no tiene el producto y ofrece otros de su catálogo.
create function public.ofrecer_alternativas(p_reserva bigint, p_productos bigint[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'pendiente' then
    raise exception 'Solo se ofrecen alternativas a reservas pendientes';
  end if;
  if coalesce(array_length(p_productos, 1), 0) = 0 then
    raise exception 'Elegí al menos una alternativa';
  end if;
  if exists (
    select 1
    from unnest(p_productos) as x (id)
    left join public.productos p
      on p.id = x.id and p.comercio_id = r.comercio_id and p.activo
    where p.id is null
       or p.id = r.producto_id
       or (p.modo = 'exacto' and coalesce(p.stock, 0) = 0)
       or (p.modo = 'semaforo' and p.semaforo = 'no')
  ) then
    raise exception 'Alguna alternativa no es de tu catálogo o no tiene stock';
  end if;

  insert into public.reserva_alternativas (reserva_id, producto_id)
  select distinct r.id, x.id from unnest(p_productos) as x (id)
  on conflict do nothing;
  update public.reservas set estado = 'alternativa', actualizada_en = now() where id = r.id;
end;
$$;

-- Comprador: elige una de las alternativas (queda aceptada).
create function public.elegir_alternativa(p_reserva bigint, p_producto bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  p public.productos;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'alternativa' then
    raise exception 'Esta reserva no tiene alternativas para elegir';
  end if;
  if not exists (select 1 from public.reserva_alternativas where reserva_id = r.id and producto_id = p_producto) then
    raise exception 'Ese producto no está entre las alternativas ofrecidas';
  end if;

  select * into p from public.productos where id = p_producto;
  perform public.descontar_stock(p.id, r.cantidad);

  update public.reservas set
    producto_original_id = coalesce(r.producto_original_id, r.producto_id),
    producto_id = p.id,
    producto_nombre = p.nombre,
    precio_unitario = p.precio,
    medio_pago = case when p.precio is null then 'local'::public.medio_pago else r.medio_pago end,
    estado = 'aceptada',
    actualizada_en = now()
  where id = r.id;
  delete from public.reserva_alternativas where reserva_id = r.id;
end;
$$;

-- Comerciante: el cliente pasó a buscarlo.
create function public.marcar_retirada(p_reserva bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' then
    raise exception 'Solo se marcan como retiradas las reservas aceptadas';
  end if;
  update public.reservas set estado = 'retirada', actualizada_en = now() where id = r.id;
end;
$$;

-- Comprador: cancela (si ya estaba aceptada, el stock vuelve).
create function public.cancelar_reserva(p_reserva bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado not in ('pendiente', 'alternativa', 'aceptada') then
    raise exception 'La reserva ya no se puede cancelar (está %)', r.estado;
  end if;
  if r.estado = 'aceptada' then
    perform public.devolver_stock(r.producto_id, r.cantidad);
  end if;
  delete from public.reserva_alternativas where reserva_id = r.id;
  update public.reservas set estado = 'cancelada', actualizada_en = now() where id = r.id;
end;
$$;

-- Vence las reservas que el comercio no respondió a tiempo.
-- Se puede programar más adelante con Cron (Integrations > Cron en Supabase).
create function public.vencer_reservas(p_horas integer default 24)
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

-- ---------------------------------------------------------------------
-- Consultas para la app
-- ---------------------------------------------------------------------

-- Comercios aprobados dentro de un radio, con búsqueda opcional por
-- nombre, rubro o producto (sin importar acentos).
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
  abre time,
  cierra time,
  whatsapp text,
  distancia_km double precision
)
language sql stable set search_path = ''
as $$
  select t.*
  from (
    select c.id, c.nombre, c.rubro, c.direccion, c.zona_id, c.lat, c.lng, c.abre, c.cierra, c.whatsapp,
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

-- Números del panel del comerciante.
create function public.estadisticas_comercio(
  p_comercio bigint,
  p_desde timestamptz default now() - interval '7 days'
)
returns table (
  total_vistas bigint,
  total_reservas bigint,
  total_retiradas bigint,
  promedio_estrellas numeric,
  total_resenas bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_dueno(p_comercio) then
    raise exception 'Solo el dueño del comercio ve sus estadísticas';
  end if;
  return query select
    (select count(*) from public.vistas v where v.comercio_id = p_comercio and v.creada_en >= p_desde),
    (select count(*) from public.reservas r where r.comercio_id = p_comercio and r.creada_en >= p_desde),
    (select count(*) from public.reservas r where r.comercio_id = p_comercio and r.estado = 'retirada' and r.actualizada_en >= p_desde),
    (select round(avg(e.estrellas), 1) from public.resenas e where e.comercio_id = p_comercio),
    (select count(*) from public.resenas e where e.comercio_id = p_comercio);
end;
$$;

-- Quién puede llamar a cada función.
revoke execute on function public.descontar_stock(bigint, integer) from public, anon, authenticated;
revoke execute on function public.devolver_stock(bigint, integer) from public, anon, authenticated;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;

revoke execute on function public.aceptar_reserva(bigint) from public, anon;
revoke execute on function public.rechazar_reserva(bigint) from public, anon;
revoke execute on function public.ofrecer_alternativas(bigint, bigint[]) from public, anon;
revoke execute on function public.elegir_alternativa(bigint, bigint) from public, anon;
revoke execute on function public.marcar_retirada(bigint) from public, anon;
revoke execute on function public.cancelar_reserva(bigint) from public, anon;
revoke execute on function public.estadisticas_comercio(bigint, timestamptz) from public, anon;

-- crear_perfil solo corre como trigger al registrarse.
revoke execute on function public.crear_perfil() from public, anon, authenticated;

-- Índices de claves foráneas que pidió el asesor de Supabase.
create index on public.resenas (autor_id);
create index on public.reserva_alternativas (producto_id);
create index on public.reservas (producto_id);
create index on public.reservas (producto_original_id);
create index on public.vistas (producto_id);

-- ---------------------------------------------------------------------
-- Fotos de productos (Storage)
-- Carpeta por comercio: productos/<id del comercio>/foto.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

create policy "fotos: subir del dueño" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.es_dueno_carpeta((storage.foldername(name))[1]));
create policy "fotos: cambiar del dueño" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.es_dueno_carpeta((storage.foldername(name))[1]));
create policy "fotos: borrar del dueño" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.es_dueno_carpeta((storage.foldername(name))[1]));
