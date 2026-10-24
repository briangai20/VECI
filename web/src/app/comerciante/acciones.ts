"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { avisarReserva, type Evento } from "@/lib/avisos";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { emparejar, MAX_FILAS, type FilaProducto } from "@/lib/importar";
import type { Enum, TablesInsert, TablesUpdate } from "@/lib/supabase/tipos";

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

// Lee el horario semanal del formulario (ver horario-semanal.tsx) y lo valida.
function leerHorario(d: FormData): { franjas: { dia: number; abre: string; cierra: string }[] } | { error: string } {
  const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const hora = (k: string) => (/^\d{2}:\d{2}$/.test(texto(d, k)) ? texto(d, k) : "");
  const franjas: { dia: number; abre: string; cierra: string }[] = [];
  for (let dia = 0; dia < 7; dia++) {
    if (d.get(`h${dia}on`) !== "on") continue;
    const [a1, c1, a2, c2] = [hora(`h${dia}a1`), hora(`h${dia}c1`), hora(`h${dia}a2`), hora(`h${dia}c2`)];
    if (!a1 || !c1 || a1 === c1) return { error: `Revisá el horario del ${NOMBRES[dia]}: poné a qué hora abrís y a qué hora cerrás.` };
    franjas.push({ dia, abre: a1, cierra: c1 });
    if (a2 || c2) {
      if (!a2 || !c2 || a2 === c2) return { error: `Revisá el horario de la tarde del ${NOMBRES[dia]}.` };
      if (c1 < a1 || a2 < c1) return { error: `El ${NOMBRES[dia]}, la segunda franja tiene que empezar después de que cerrás al mediodía.` };
      franjas.push({ dia, abre: a2, cierra: c2 });
    }
  }
  if (!franjas.length) return { error: "Marcá al menos un día en que abre tu comercio." };
  return { franjas };
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
    whatsapp: opcional(d, "whatsapp"),
    abre_feriados: d.get("abre_feriados") === "on",
    lat,
    lng,
  };
  if (!datos.nombre || !datos.rubro || !datos.direccion || !datos.zona_id) return { error: "Completá nombre, rubro, dirección y zona." };
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return { error: "Marcá en el mapa dónde está tu local." };
  if (datos.whatsapp && datos.whatsapp.replace(/\D/g, "").length < 10) return { error: "Revisá el WhatsApp: poné el número con código de área, por ejemplo 11 2345 6789." };
  const horario = leerHorario(d);
  if ("error" in horario) return { error: horario.error };

  let comercioId = id;
  if (id) {
    const { error } = await supabase.from("comercios").update(datos).eq("id", id);
    if (error) return { error: "No pudimos guardar los datos. Probá de nuevo." };
  } else {
    const { data, error } = await supabase.from("comercios").insert(datos).select("id").single();
    if (error) return { error: "No pudimos guardar los datos. Probá de nuevo." };
    comercioId = data.id;
  }

  // El horario se reemplaza entero.
  const { error: errorBorrar } = await supabase.from("horarios").delete().eq("comercio_id", comercioId!);
  const { error: errorHorario } = errorBorrar
    ? { error: errorBorrar }
    : await supabase.from("horarios").insert(horario.franjas.map((f) => ({ ...f, comercio_id: comercioId! })));
  if (errorHorario) return { error: "Guardamos los datos, pero no el horario. Probá guardar de nuevo." };
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
  const evento: Evento = accion === "aceptar" ? "aceptada" : accion === "rechazar" ? "rechazada" : "retirada";
  after(() => avisarReserva(reserva, evento));
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
  after(() => avisarReserva(reserva, "alternativa"));
  redirect("/comerciante#reservas"); // vuelve sin el cartel de error, si había uno
}

// Días que el comercio cierra por su cuenta (vacaciones, inventario...).
export async function agregarCierre(d: FormData) {
  const supabase = await comerciante();
  const comercio = Number(texto(d, "comercio_id"));
  const desde = texto(d, "desde");
  const hasta = texto(d, "hasta") || desde;
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(desde) || !fecha.test(hasta) || hasta < desde) {
    redirect(`/comerciante?error=${encodeURIComponent("Revisá las fechas del cierre: la fecha final no puede ser anterior a la inicial.")}#cierres`);
  }
  const { error } = await supabase
    .from("cierres")
    .insert({ comercio_id: comercio, desde, hasta, motivo: opcional(d, "motivo")?.slice(0, 80) ?? null });
  if (error) redirect(`/comerciante?error=${encodeURIComponent("No pudimos guardar el cierre. Probá de nuevo.")}#cierres`);
  redirect("/comerciante#cierres");
}

export async function borrarCierre(d: FormData) {
  const supabase = await comerciante();
  await supabase.from("cierres").delete().eq("id", Number(texto(d, "id")));
  redirect("/comerciante#cierres");
}

// Guarda la foto recién subida a Storage y borra la anterior, si era nuestra.
export async function guardarFoto(productoId: number, url: string) {
  const supabase = await comerciante();
  const { data: p } = await supabase.from("productos").select("comercio_id, foto_url").eq("id", productoId).single();
  if (!p) throw new Error("Producto no encontrado");
  const carpeta = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/${p.comercio_id}/`;
  if (!url.startsWith(carpeta)) throw new Error("La foto no es de este comercio");

  const { error } = await supabase.from("productos").update({ foto_url: url }).eq("id", productoId);
  if (error) throw new Error("No se pudo guardar la foto");
  const raiz = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/`;
  if (p.foto_url?.startsWith(raiz)) await supabase.storage.from("productos").remove([p.foto_url.slice(raiz.length)]);
  refresh();
}

export type ResultadoImportacion = { error?: string; agregados?: number; actualizados?: number };

// Carga masiva desde la planilla (ya interpretada en el navegador con
// lib/importar.ts). Agrega los productos nuevos y actualiza los que ya
// estaban (por código o, si no hay código, por nombre). No borra ni oculta
// los que no vienen en la planilla.
export async function importarProductos(comercioId: number, filas: FilaProducto[]): Promise<ResultadoImportacion> {
  const supabase = await comerciante();
  if (!Array.isArray(filas) || !filas.length) return { error: "La planilla no tiene productos." };
  if (filas.length > MAX_FILAS) return { error: `Son más de ${MAX_FILAS} productos: dividí la planilla en dos.` };

  // No confiamos en lo que manda el navegador: se limpia de nuevo cada dato.
  const MODOS = ["exacto", "semaforo", "consultar", "pedido"];
  const SEMAFOROS = ["hay", "poco", "no"];
  const corto = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const limpias = filas
    .map((f) => ({
      fila: Number(f.fila) || 0,
      codigo: corto(f.codigo, 60),
      nombre: corto(f.nombre, 200) ?? "",
      marca: corto(f.marca, 80),
      grupo: corto(f.grupo, 120),
      descripcion: corto(f.descripcion, 1000),
      precio: f.precio === undefined ? undefined : typeof f.precio === "number" && f.precio >= 0 && f.precio < 1e9 ? f.precio : null,
      modo: MODOS.includes(f.modo as string) ? (f.modo as Enum<"modo_stock">) : undefined,
      stock: typeof f.stock === "number" && f.stock >= 0 && f.stock < 1e6 ? Math.floor(f.stock) : null,
      semaforo: SEMAFOROS.includes(f.semaforo as string) ? (f.semaforo as Enum<"semaforo">) : null,
    }))
    .filter((f) => f.nombre);

  // Solo trae productos si el comercio es suyo (RLS); si no, el alta falla abajo.
  const { data: existentes, error: errorLeer } = await supabase.from("productos").select("id, codigo, nombre").eq("comercio_id", comercioId);
  if (errorLeer) return { error: "No pudimos leer tus productos. Probá de nuevo." };

  const stockDe = (f: (typeof limpias)[number]) =>
    f.modo === undefined
      ? {}
      : { modo: f.modo, stock: f.modo === "exacto" ? (f.stock ?? 0) : null, semaforo: f.modo === "semaforo" ? (f.semaforo ?? "hay") : null };

  const nuevos: TablesInsert<"productos">[] = [];
  const cambios: { id: number; datos: TablesUpdate<"productos"> }[] = [];
  for (const { fila: f, existente } of emparejar(limpias, existentes ?? [])) {
    if (existente) {
      cambios.push({
        id: existente.id,
        datos: {
          nombre: f.nombre,
          activo: true,
          ...(f.codigo ? { codigo: f.codigo } : {}),
          ...(f.marca ? { marca: f.marca } : {}),
          ...(f.grupo ? { grupo: f.grupo } : {}),
          ...(f.descripcion ? { descripcion: f.descripcion } : {}),
          ...(f.precio !== undefined ? { precio: f.precio } : {}),
          ...stockDe(f),
        },
      });
    } else {
      nuevos.push({
        comercio_id: comercioId,
        codigo: f.codigo,
        nombre: f.nombre,
        marca: f.marca,
        grupo: f.grupo,
        descripcion: f.descripcion,
        precio: f.precio ?? null,
        modo: "consultar",
        stock: null,
        semaforo: null,
        ...stockDe(f),
      });
    }
  }

  if (nuevos.length) {
    const { error } = await supabase.from("productos").insert(nuevos);
    if (error) return { error: "No pudimos agregar los productos nuevos. Revisá que no haya códigos repetidos y probá de nuevo." };
  }
  let actualizados = 0;
  for (let i = 0; i < cambios.length; i += 25) {
    const tanda = await Promise.all(cambios.slice(i, i + 25).map((c) => supabase.from("productos").update(c.datos).eq("id", c.id)));
    actualizados += tanda.filter((r) => !r.error).length;
  }
  refresh();
  return { agregados: nuevos.length, actualizados };
}
