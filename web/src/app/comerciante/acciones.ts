"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";

export type Estado = { error?: string; ok?: string };

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const opcional = (d: FormData, k: string) => texto(d, k) || null;
// Los campos numéricos del formulario (type="number") ya llegan con punto decimal.
function numero(d: FormData, k: string) {
  const v = texto(d, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Todas las acciones exigen sesión de comerciante. Que el comercio o el
// producto sean suyos lo controlan las reglas de la base (RLS).
async function comerciante() {
  const u = await usuarioActual();
  if (!u) redirect("/ingresar?siguiente=/comerciante");
  if (u.rol !== "comerciante") throw new Error("Solo los comerciantes pueden hacer esto");
  return supabaseServidor();
}

export async function guardarComercio(_: Estado, d: FormData): Promise<Estado> {
  const supabase = await comerciante();
  const id = Number(texto(d, "id")) || null;
  const lat = numero(d, "lat");
  const lng = numero(d, "lng");
  const datos = {
    nombre: texto(d, "nombre"),
    rubro: texto(d, "rubro"),
    direccion: texto(d, "direccion"),
    zona_id: texto(d, "zona_id"),
    abre: opcional(d, "abre"),
    cierra: opcional(d, "cierra"),
    whatsapp: opcional(d, "whatsapp"),
    lat,
    lng,
  };
  if (!datos.nombre || !datos.rubro || !datos.direccion || !datos.zona_id) return { error: "Completá nombre, rubro, dirección y zona." };
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return { error: "Marcá en el mapa dónde está tu local." };
  if (datos.whatsapp && datos.whatsapp.replace(/\D/g, "").length < 10) return { error: "Revisá el WhatsApp: poné el número con código de área, por ejemplo 11 2345 6789." };

  const { error } = id
    ? await supabase.from("comercios").update(datos).eq("id", id)
    : await supabase.from("comercios").insert(datos);
  if (error) return { error: "No pudimos guardar los datos. Probá de nuevo." };
  refresh();
  return { ok: id ? "Datos guardados." : "¡Listo! Ya podés cargar tus productos. Publicamos tu comercio cuando lo revisemos." };
}

export async function guardarProducto(d: FormData) {
  const supabase = await comerciante();
  const id = Number(texto(d, "id")) || null;
  const modo = (["exacto", "semaforo", "consultar", "pedido"].includes(texto(d, "modo")) ? texto(d, "modo") : "exacto") as Enum<"modo_stock">;
  const semaforo = (["hay", "poco", "no"].includes(texto(d, "semaforo")) ? texto(d, "semaforo") : null) as Enum<"semaforo"> | null;
  const precio = numero(d, "precio");
  const stock = numero(d, "stock");
  const datos = {
    nombre: texto(d, "nombre"),
    marca: opcional(d, "marca"),
    grupo: opcional(d, "grupo"),
    descripcion: opcional(d, "descripcion"),
    codigo: opcional(d, "codigo"),
    precio: precio == null || Number.isNaN(precio) || precio < 0 ? null : precio,
    modo,
    stock: modo === "exacto" ? Math.max(0, Math.round(stock && !Number.isNaN(stock) ? stock : 0)) : null,
    semaforo: modo === "semaforo" ? (semaforo ?? "hay") : null,
    activo: d.get("activo") === "on",
  };
  if (!datos.nombre) return;

  if (id) {
    await supabase.from("productos").update(datos).eq("id", id);
  } else {
    const comercioId = Number(texto(d, "comercio_id"));
    await supabase.from("productos").insert({ ...datos, comercio_id: comercioId });
  }
  refresh();
}

// "Sigue igual": confirma el stock sin cambiarlo, para que no aparezca "Sin verificar".
export async function confirmarStock(d: FormData) {
  const supabase = await comerciante();
  const id = Number(texto(d, "id"));
  if (id) await supabase.from("productos").update({ actualizado_en: new Date().toISOString() }).eq("id", id);
  refresh();
}

// Si la base rechaza la acción (por ejemplo, ya no hay stock), volvemos al
// panel con el motivo. Los mensajes "P0001" los escribe la base en castellano.
function volverConError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const motivo = error.code === "P0001" ? error.message : "No pudimos guardar el cambio. Probá de nuevo.";
  redirect(`/comerciante?error=${encodeURIComponent(motivo)}#reservas`);
}

export async function cambiarReserva(d: FormData) {
  const supabase = await comerciante();
  const reserva = Number(texto(d, "reserva"));
  const accion = texto(d, "accion");
  if (!reserva) return;
  const rpc =
    accion === "aceptar" ? "aceptar_reserva" : accion === "rechazar" ? "rechazar_reserva" : accion === "retirada" ? "marcar_retirada" : null;
  if (!rpc) return;
  const { error } = await supabase.rpc(rpc, { p_reserva: reserva });
  volverConError(error);
  redirect("/comerciante#reservas"); // vuelve sin el cartel de error, si había uno
}

// "No lo tengo": le ofrece al cliente otros productos del catálogo.
export async function ofrecerAlternativas(d: FormData) {
  const supabase = await comerciante();
  const reserva = Number(texto(d, "reserva"));
  const productos = d.getAll("productos").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!reserva) return;
  if (!productos.length) redirect(`/comerciante?error=${encodeURIComponent("Elegí al menos un producto para ofrecer.")}#reservas`);
  const { error } = await supabase.rpc("ofrecer_alternativas", { p_reserva: reserva, p_productos: productos });
  volverConError(error);
  redirect("/comerciante#reservas"); // vuelve sin el cartel de error, si había uno
}
