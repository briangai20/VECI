import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/tipos";
import { plata } from "./formato";

// Avisos por mail con Resend. Necesitan dos variables SOLO de servidor
// (nunca con NEXT_PUBLIC_):
//   RESEND_API_KEY       clave de Resend (resend.com > API Keys)
//   SUPABASE_SECRET_KEY  clave secreta de Supabase, para leer el mail de
//                        cada usuario (Project Settings > API Keys > Secret)
// Opcional: MAIL_REMITENTE, por ejemplo "VECI <avisos@veci.com.ar>".
// Si falta alguna, no se manda nada y la app sigue andando igual.

export type Evento =
  | "nueva" // al comercio
  | "cancelada" // al comercio
  | "alternativa_elegida" // al comercio
  | "aceptada" // al comprador
  | "rechazada" // al comprador
  | "alternativa" // al comprador
  | "retirada"; // al comprador (pide la reseña)

const AL_COMERCIO: Evento[] = ["nueva", "cancelada", "alternativa_elegida"];

function sitio() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function admin() {
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function enviar(para: string, asunto: string, html: string) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.info(`[avisos] Sin RESEND_API_KEY: no se mandó "${asunto}"`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_REMITENTE || "VECI <onboarding@resend.dev>", to: [para], subject: asunto, html }),
  });
  if (!r.ok) console.error(`[avisos] Resend respondió ${r.status}: ${await r.text()}`);
}

function plantilla(titulo: string, cuerpo: string, boton: { texto: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;background:#FFF8EC;padding:24px">
  <div style="max-width:520px;margin:auto;background:#14213D;color:#fff;border-radius:16px;padding:24px">
    <p style="margin:0;font-size:22px;font-weight:900">VECI</p>
    <h1 style="font-size:18px;margin:16px 0 8px">${titulo}</h1>
    <div style="font-size:14px;line-height:1.5">${cuerpo}</div>
    <a href="${boton.url}" style="display:inline-block;margin-top:20px;background:#D9480F;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">${boton.texto}</a>
  </div>
</div>`;
}

// Arma y manda el aviso de una reserva. Nunca tira error: un mail que no
// sale no puede romper la reserva.
export async function avisarReserva(reservaId: number, evento: Evento) {
  try {
    const db = admin();
    if (!db) {
      console.info(`[avisos] Sin SUPABASE_SECRET_KEY: no se avisó "${evento}" de la reserva ${reservaId}`);
      return;
    }
    const { data: r } = await db
      .from("reservas")
      .select("*, comercio:comercios(nombre, direccion, dueno_id), comprador:perfiles!reservas_comprador_id_fkey(nombre)")
      .eq("id", reservaId)
      .maybeSingle();
    if (!r?.comercio) return;

    const alComercio = AL_COMERCIO.includes(evento);
    const destinatario = alComercio ? r.comercio.dueno_id : r.comprador_id;
    const { data: u } = await db.auth.admin.getUserById(destinatario);
    const mail = u.user?.email;
    if (!mail) return;

    const producto = `${esc(r.producto_nombre)} × ${r.cantidad}`;
    const total = plata(r.precio_unitario == null ? null : r.precio_unitario * r.cantidad);
    const cliente = esc(r.comprador?.nombre || "Un cliente");
    const comercio = esc(r.comercio.nombre);
    const panel = { texto: "Abrir mi panel", url: `${sitio()}/comerciante#reservas` };
    const misReservas = { texto: "Ver mis reservas", url: `${sitio()}/reservas` };

    const mensajes: Record<Evento, [string, string, { texto: string; url: string }]> = {
      nueva: [
        `Nueva reserva: ${r.producto_nombre}`,
        `<p>${cliente} reservó <b>${producto}</b> (${total}) para retirar <b>${esc(r.retiro)}</b>.</p><p>Tenés <b>2 horas</b> para aceptarla, rechazarla u ofrecer otra cosa. Si no, vence sola.</p>`,
        panel,
      ],
      cancelada: [`${r.comprador?.nombre || "El cliente"} canceló una reserva`, `<p>${cliente} canceló <b>${producto}</b>. Si ya la habías aceptado, el stock volvió a tu catálogo.</p>`, panel],
      alternativa_elegida: [
        `${r.comprador?.nombre || "El cliente"} eligió una alternativa`,
        `<p>${cliente} eligió <b>${producto}</b> (${total}). Quedó confirmada: separalo para el retiro <b>${esc(r.retiro)}</b>.</p>`,
        panel,
      ],
      aceptada: [
        `${r.comercio.nombre} confirmó tu reserva`,
        `<p>Ya te separaron <b>${producto}</b>. Pasá a retirarlo <b>${esc(r.retiro)}</b> por ${esc(r.comercio.direccion)}.</p><p>Total a pagar en el local: <b>${total}</b>.</p>`,
        misReservas,
      ],
      rechazada: [
        `${r.comercio.nombre} no pudo confirmar tu reserva`,
        `<p>${comercio} no tiene <b>${producto}</b> en este momento. No se cobró nada. Podés buscarlo en otro comercio cercano.</p>`,
        { texto: "Buscar en otro comercio", url: sitio() },
      ],
      alternativa: [
        `${r.comercio.nombre} te ofrece otra opción`,
        `<p>${comercio} no tiene <b>${producto}</b>, pero te ofrece alternativas. Elegí una dentro de las 2 horas de tu reserva, o cancelala sin costo.</p>`,
        misReservas,
      ],
      retirada: [
        `¿Cómo te fue en ${r.comercio.nombre}?`,
        `<p>Gracias por retirar <b>${producto}</b>. Contale a tus vecinos cómo te atendieron: dejá una reseña en un minuto.</p>`,
        { texto: "Dejar mi reseña", url: `${sitio()}/reservas` },
      ],
    };

    const [asunto, cuerpo, boton] = mensajes[evento];
    await enviar(mail, asunto, plantilla(esc(asunto), cuerpo, boton));
  } catch (e) {
    console.error("[avisos] No se pudo mandar el aviso", e);
  }
}
