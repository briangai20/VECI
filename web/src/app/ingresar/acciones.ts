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

// Manda el mail para elegir una contraseña nueva. Siempre responde lo mismo,
// exista o no la cuenta, para no revelar qué mails están registrados.
export async function pedirNuevaClave(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const email = String(datos.get("email") ?? "").trim();
  if (!email) return { error: "Escribí el mail con el que te registraste." };
  const h = await headers();
  const origen = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origen}/auth/callback?siguiente=${encodeURIComponent("/nueva-clave")}`,
  });
  if (error && error.message.toLowerCase().includes("rate limit")) return { error: traducir(error.message), valores: { email } };
  return { aviso: `Si hay una cuenta con ${email}, te llega un mail con un link para elegir una contraseña nueva. Revisá también el spam.` };
}

export async function cambiarClave(_: EstadoCuenta, datos: FormData): Promise<EstadoCuenta> {
  const clave = String(datos.get("password") ?? "");
  const repetida = String(datos.get("repetida") ?? "");
  if (clave.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  if (clave !== repetida) return { error: "Las dos contraseñas no coinciden." };
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "El link venció. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”." };
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("different from the old")) return { error: "Elegí una contraseña distinta de la anterior." };
    return { error: traducir(error.message) };
  }
  return { aviso: "¡Listo! Tu contraseña nueva ya quedó guardada." };
}
