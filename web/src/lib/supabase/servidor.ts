import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./tipos";

// Cliente con la sesión del usuario (lee y renueva la cookie de sesión).
// Solo en el servidor: Server Components, Server Actions y Route Handlers.
export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // En un Server Component no se pueden escribir cookies; las renueva proxy.ts.
          }
        },
      },
    },
  );
}
