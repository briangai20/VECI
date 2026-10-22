-- =====================================================================
-- VECI · Borra los datos de prueba de 03_datos_prueba.sql
-- Al borrar los usuarios @demo.veci.test se borran en cascada sus
-- perfiles, comercios, productos, reservas, reseñas y vistas.
-- Correrlo antes de lanzar con comercios reales.
-- =====================================================================
delete from auth.users where email like '%@demo.veci.test';
