-- =====================================================================
-- VECI · "actualizado_en" de productos (2026-10-23)
-- Antes, cualquier cambio (hasta la descripción) marcaba el stock como
-- recién verificado. Ahora solo cuenta si cambia stock, semáforo, precio,
-- modo o si está activo, o si el comerciante toca "Sigue igual" (la app
-- manda actualizado_en y la base lo reemplaza por la hora real).
-- =====================================================================
create or replace function public.tocar_producto()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.stock, new.semaforo, new.precio, new.modo, new.activo)
       is distinct from (old.stock, old.semaforo, old.precio, old.modo, old.activo)
     or new.actualizado_en is distinct from old.actualizado_en then
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;
