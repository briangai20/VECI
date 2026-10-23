import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { supabaseServidor } from "./supabase/servidor";
import type { Enum } from "./supabase/tipos";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Enum<"rol_usuario">;
};

// Usuario con sesión iniciada, o null. Se lee una vez por pedido.
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  // La sesión siempre se lee en el pedido (Supabase compara su vencimiento con la hora actual).
  await connection();
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfiles").select("nombre, rol").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    nombre: perfil?.nombre ?? "",
    rol: perfil?.rol ?? "comprador",
  };
});
