import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Estrellas } from "@/components/insignias";
import { plata } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";
import { cancelar, dejarResena, elegirAlternativa } from "./acciones";

export const metadata: Metadata = { title: "Mis reservas" };

const ESTADOS: Record<Enum<"estado_reserva">, { texto: string; detalle: string }> = {
  pendiente: {
    texto: "Esperando al comercio",
    detalle: "El comercio tiene que confirmar que lo tiene. Si no responde en 2 horas, la reserva vence sola y no se cobra nada.",
  },
  alternativa: {
    texto: "Te ofrecen otra opción",
    detalle: "El comercio no lo tiene, pero te ofrece estas alternativas. Elegí una dentro de las 2 horas de tu reserva.",
  },
  aceptada: { texto: "Confirmada: pasá a retirar", detalle: "Ya te lo separaron. Pagás al retirar." },
  retirada: { texto: "Retirada", detalle: "" },
  rechazada: { texto: "El comercio no la pudo confirmar", detalle: "No se cobró nada." },
  cancelada: { texto: "Cancelada", detalle: "" },
  vencida: { texto: "Vencida", detalle: "El comercio no respondió a tiempo. No se cobró nada." },
};

export default function PaginaReservas({ searchParams }: PageProps<"/reservas">) {
  return (
    <Suspense fallback={<div className="tarjeta h-72 animate-pulse rounded-3xl" />}>
      <Reservas searchParams={searchParams} />
    </Suspense>
  );
}

async function Reservas({ searchParams }: Pick<PageProps<"/reservas">, "searchParams">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/reservas");
  const { nueva, error } = await searchParams;

  const supabase = await supabaseServidor();
  const { data: reservas } = await supabase
    .from("reservas")
    .select(
      "*, comercio:comercios(id, nombre, direccion, lat, lng), alternativas:reserva_alternativas(producto:productos(id, nombre, precio)), resena:resenas(estrellas, texto)",
    )
    .eq("comprador_id", usuario.id)
    .order("creada_en", { ascending: false });

  const lista = reservas ?? [];
  const abiertas = lista.filter((r) => ["pendiente", "alternativa", "aceptada"].includes(r.estado));
  const total = abiertas.reduce((a, r) => a + (r.precio_unitario ?? 0) * r.cantidad, 0);

  return (
    <>
      {typeof error === "string" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          {error}
        </p>
      ) : null}
      {nueva ? (
        <p className="mb-4 rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          <span className="font-semibold">¡Listo, reservaste!</span> El comercio la tiene que confirmar; vas a ver el estado acá.
        </p>
      ) : null}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis reservas</h1>
          <p className="text-sm text-marino/80">Retirás en el local, en el horario que elegiste.</p>
        </div>
        {abiertas.length ? (
          <div className="tarjeta rounded-2xl px-5 py-3 text-right">
            <p className="text-xs text-white/80">Total a pagar al retirar</p>
            <p className="text-xl font-black">{plata(total)}</p>
          </div>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <div className="tarjeta mx-auto max-w-xl rounded-3xl p-10 text-center">
          <h2 className="text-xl font-bold">Todavía no tenés reservas</h2>
          <p className="mt-2 text-sm text-white/80">Buscá un producto, elegí un comercio cercano y tocá Reservar.</p>
          <Link href="/" className="boton mt-6 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
            Ir a buscar
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((r) => {
            const e = ESTADOS[r.estado];
            const c = r.comercio;
            return (
              <article key={r.id} className="tarjeta rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-white/75">{c?.nombre}</p>
                    <h2 className="font-semibold">
                      {r.producto_nombre} × {r.cantidad}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/40 px-2.5 py-1 text-[11px] font-semibold">{e.texto}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-white/60">Retiro</p>
                    <p className="font-medium">{r.retiro}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/60">Total</p>
                    <p className="font-bold">{plata(r.precio_unitario == null ? null : r.precio_unitario * r.cantidad)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/75">
                  {c?.direccion}
                  {c?.lat != null && c?.lng != null ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className="underline">
                        Cómo llegar
                      </a>
                    </>
                  ) : null}
                </p>
                {e.detalle ? <p className="mt-2 text-xs text-white/85">{e.detalle}</p> : null}

                {r.estado === "alternativa" && r.alternativas.length ? (
                  <div className="mt-3 space-y-2">
                    {r.alternativas.map((a) =>
                      a.producto ? (
                        <form key={a.producto.id} action={elegirAlternativa} className="flex items-center justify-between gap-2 rounded-xl border border-white/25 p-3 text-sm">
                          <input type="hidden" name="reserva" value={r.id} />
                          <input type="hidden" name="producto" value={a.producto.id} />
                          <span>
                            {a.producto.nombre} · {plata(a.producto.precio)} c/u
                          </span>
                          <button className="boton rounded-lg px-3 py-1.5 text-xs font-semibold">Elegir esta</button>
                        </form>
                      ) : null,
                    )}
                  </div>
                ) : null}

                {["pendiente", "alternativa", "aceptada"].includes(r.estado) ? (
                  <form action={cancelar} className="mt-4">
                    <input type="hidden" name="reserva" value={r.id} />
                    <button className="w-full rounded-xl border border-white/30 py-2 text-sm hover:bg-white/10">Cancelar reserva</button>
                  </form>
                ) : null}

                {r.estado === "retirada" ? (
                  r.resena ? (
                    <div className="mt-4 rounded-xl border border-white/25 p-3 text-sm">
                      <p className="text-xs text-white/75">Tu reseña</p>
                      <Estrellas valor={r.resena.estrellas} />
                      {r.resena.texto ? <p className="mt-1">{r.resena.texto}</p> : null}
                    </div>
                  ) : (
                    <form action={dejarResena} className="mt-4 space-y-2 rounded-xl border border-white/25 p-3">
                      <input type="hidden" name="reserva" value={r.id} />
                      <p className="text-sm font-semibold">¿Cómo te atendieron?</p>
                      <div className="flex gap-3 text-sm">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="flex items-center gap-1">
                            <input type="radio" name="estrellas" value={n} required className="accent-white" />
                            {n}★
                          </label>
                        ))}
                      </div>
                      <textarea name="texto" rows={2} maxLength={1000} placeholder="Contá tu experiencia (opcional)" className="campo" />
                      <button className="boton rounded-lg px-4 py-2 text-sm font-semibold">Publicar reseña</button>
                    </form>
                  )
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
