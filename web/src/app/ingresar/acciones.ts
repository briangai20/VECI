"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";

// "valores" devuelve lo que escribió el usuario, para no borrarle el formulario si hay un error.
export type EstadoCuenta = { error?: string; aviso?: string; valores?: { nombre?: string; email?: string; rol?: string } };

// Sólo rutas internas, para que nadie arme un link que mande a otro sitio.
function destinoSeguro(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

function traducir(mensaje: string) {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "El mail o la contraseña no son correctos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu mail. Revisá tu casilla (y la carpeta de spam).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya hay una cuenta con ese mail. Probá ingresar.";
  if (m.includes("password") && m.includes("characters")) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (m.includes("rate limit")) return "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (m.includes("email address") && m.includes("invalid")) return "Revisá el mail: no parece una dirección válida.";
  if (m.includes("not authorized")) return "Por ahora no podemos mandar mails a esa dirección. Escribinos para darte de alta.";
  return "No pudimos completar el pedido. Probá de nuevo en un rato.";
}

export async function ingresar(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  if (!email || !password) return { error: "Completá tu mail y tu contraseña.", valores: { email } };

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traducir(error.message), valores: { email } };
  redirect(destinoSeguro(datos.get("siguiente")));
}

export async function registrarse(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  const rol = datos.get("rol") === "comerciante" ? "comerciante" : "comprador";
  const valores = { nombre, email, rol };
  if (!nombre || !email || !password) return { error: "Completá todos los campos.", valores };
  if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres.", valores };

  const h = await headers();
  const origen = h.get("origin") ?? `https://${h.get("host")}`;
  const siguiente = rol === "comerciante" ? "/comerciante" : destinoSeguro(datos.get("siguiente"));

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, rol },
      emailRedirectTo: `${origen}/auth/callback?siguiente=${encodeURIComponent(siguiente)}`,
    },
  });
  if (error) return { error: traducir(error.message), valores };

  // Si el proyecto no pide confirmar el mail, la sesión ya quedó iniciada.
  if (data.session) redirect(siguiente);
  return { aviso: `Te mandamos un mail a ${email}. Abrí el link para confirmar tu cuenta y listo.` };
}

export async function salir() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/");
}
