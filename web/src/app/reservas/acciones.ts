"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { TablesInsert } from "@/lib/supabase/tipos";

export type EstadoReserva = { error?: string };

const numero = (d: FormData, k: string) => Number(String(d.get(k) ?? ""));
const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

// Los mensajes de error los escribe la base en castellano (stock, producto
// no disponible...), así que se pueden mostrar tal cual.
function mensaje(e: { message: string; code?: string }) {
  return e.code === "P0001" ? e.message : "No pudimos hacer la reserva. Probá de nuevo en un rato.";
}

async function conSesion(siguiente: string) {
  const u = await usuarioActual();
  if (!u) redirect(`/ingresar?siguiente=${encodeURIComponent(siguiente)}`);
  return supabaseServidor();
}

export async function reservar(_: EstadoReserva, d: FormData): Promise<EstadoReserva> {
  const productoId = numero(d, "producto");
  const supabase = await conSesion(`/producto/${productoId}`);
  const cantidad = numero(d, "cantidad");
  const retiro = texto(d, "retiro");
  if (!productoId || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) return { error: "Elegí una cantidad entre 1 y 20." };
  if (!retiro) return { error: "Elegí un horario de retiro." };

  // Precio, comercio y estado los completa la base (trigger preparar_reserva).
  // El comprador solo tiene permiso para mandar estas cuatro columnas.
  const fila = { producto_id: productoId, cantidad, retiro, medio_pago: "local" } as TablesInsert<"reservas">;
  const { error } = await supabase.from("reservas").insert(fila);
  if (error) return { error: mensaje(error) };
  redirect("/reservas?nueva=1");
}

export async function cancelar(d: FormData) {
  const supabase = await conSesion("/reservas");
  await supabase.rpc("cancelar_reserva", { p_reserva: numero(d, "reserva") });
  redirect("/reservas"); // sin "?nueva=1", para que no quede el cartel de "¡Listo, reservaste!"
}

export async function elegirAlternativa(d: FormData) {
  const supabase = await conSesion("/reservas");
  const { error } = await supabase.rpc("elegir_alternativa", { p_reserva: numero(d, "reserva"), p_producto: numero(d, "producto") });
  if (error) redirect(`/reservas?error=${encodeURIComponent(mensaje(error))}`);
  redirect("/reservas");
}

export async function dejarResena(d: FormData) {
  const supabase = await conSesion("/reservas");
  const estrellas = numero(d, "estrellas");
  if (!(estrellas >= 1 && estrellas <= 5)) return;
  // Comercio, autor y fecha los completa la base (trigger preparar_resena).
  const fila = { reserva_id: numero(d, "reserva"), estrellas, texto: texto(d, "texto").slice(0, 1000) || null } as TablesInsert<"resenas">;
  await supabase.from("resenas").insert(fila);
  refresh();
}
