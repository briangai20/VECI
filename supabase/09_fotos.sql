-- =====================================================================
-- VECI · Fotos de productos (2026-10-23)
-- El bucket "productos" y sus reglas (solo el dueño sube, cambia o borra en
-- la carpeta <id del comercio>/) están en 01_esquema.sql. Acá se le pone
-- un límite de 5 MB y que acepte solo imágenes. La app además las achica a
-- 1200 px antes de subirlas.
-- =====================================================================
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'productos';

-- Para reemplazar una foto hay que borrar la anterior, y Storage solo deja
-- borrar lo que uno puede ver: el dueño ve las fotos de su carpeta.
create policy "fotos: ver del dueño" on storage.objects
  for select to authenticated
  using (bucket_id = 'productos' and public.es_dueno_carpeta((storage.foldername(name))[1]));
