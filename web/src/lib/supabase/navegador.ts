import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";

// Cliente para usar dentro de componentes "use client".
export function supabaseNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
