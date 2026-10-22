import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

// Cliente sin sesión, para leer lo que es público (comercios aprobados,
// productos activos, reseñas). Las reglas de la base deciden qué se ve.
export function supabasePublico() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
