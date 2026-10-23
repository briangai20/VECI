import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FotoProducto } from "@/components/foto-producto";
import { Abierto, Estrellas, Stock } from "@/components/insignias";
import { RegistrarVista } from "@/components/registrar-vista";
import { abiertoAhora, disponibilidad, franjasRetiro, horario, nota, plata, promedio } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { FormReserva } from "./form-reserva";
import { supabasePublico } from "@/lib/supabase/publico";

type Props = PageProps<"/producto/[id]">;

export default function PaginaProducto({ params }: Props) {
  return (
    <div className="tarjeta rounded-3xl p-5">
      <Suspense fallback={<p className="py-10 text-center text-sm text-white/80">Cargando el producto…</p>}>
        <Producto params={params} />
      </Suspense>
    </div>
  );
}

async function Producto({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const productoId = Number(id);
  if (!Number.isInteger(productoId) || productoId <= 0) notFound();

  const db = supabasePublico();
  const { data: p } = await db
    .from("productos")
    .select("*, comercio:comercios!inner(*)")
    .eq("id", productoId)
    .eq("activo", true)
    .eq("comercio.aprobado", true)
    .maybeSingle();
  if (!p) notFound();
  const c = p.comercio;

  const [{ data: hermanos }, { data: otros }, { data: resenas }] = await Promise.all([
    p.grupo
      ? db.from("productos").select("id, nombre, precio").eq("comercio_id", c.id).eq("grupo", p.grupo).eq("activo", true).order("precio")
      : Promise.resolve({ data: [] }),
    db.from("productos").select("id, nombre, precio").eq("comercio_id", c.id).eq("activo", true).neq("id", p.id).limit(8),
    db.from("resenas").select("estrellas").eq("comercio_id", c.id),
  ]);

  const ahora = new Date();
  const d = disponibilidad(p, ahora);
  const prom = promedio((resenas ?? []).map((r) => r.estrellas));
  const masProductos = (otros ?? []).filter((o) => !hermanos?.some((h) => h.id === o.id)).slice(0, 4);
  const textoBoton = !d.sePuede ? d.texto : d.requiereConfirmacion ? "Pedir reserva (requiere confirmación)" : "Reservar (Click & Collect)";
  const fila = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-white/10 py-2.5 text-sm">
      <dt className="text-white/70">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );

  return (
    <>
      <RegistrarVista comercioId={c.id} productoId={p.id} />
      <Link href={`/comercio/${c.id}`} className="text-sm text-white/80 transition hover:text-white">
        ‹ Volver a {c.nombre}
      </Link>
      <nav className="mt-3 text-xs text-white/70">
        {c.rubro} › {p.grupo || p.nombre} › {p.nombre}
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/20 bg-marino">
          <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="(min-width: 768px) 50vw, 100vw" texto="text-7xl" />
        </div>
        <div>
          <p className="text-xs text-white/80">
            Vendido por <span className="font-semibold text-white">{c.nombre}</span>
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
            <Estrellas valor={prom} />
            <span>{nota(prom) ?? "Sin reseñas"}</span>
          </div>
          <h1 className="mt-3 text-2xl leading-snug font-bold">{p.nombre}</h1>
          {p.marca ? <p className="mt-1 text-sm text-white/80">Marca: {p.marca}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Stock d={d} />
            <Abierto abierto={abiertoAhora(c.abre, c.cierra, ahora)} />
          </div>
          {d.requiereConfirmacion ? (
            <p className="mt-2 text-xs text-white/85">Este producto necesita confirmación del comercio antes de tu retiro.</p>
          ) : null}
          <p className="mt-4 text-3xl font-black">{plata(p.precio)}</p>

          {d.sePuede ? (
            <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-xl bg-white/5" />}>
              <Reserva
                productoId={p.id}
                maximo={p.modo === "exacto" && !d.requiereConfirmacion ? Math.min(Math.max(p.stock ?? 1, 1), 20) : 10}
                franjas={franjasRetiro(c.abre, c.cierra, ahora)}
                textoBoton={textoBoton}
                precio={p.precio}
              />
            </Suspense>
          ) : (
            <button type="button" disabled className="boton mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold">
              {textoBoton}
            </button>
          )}
          {c.whatsapp ? (
            <a
              href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi en VECI "${p.nombre}". ¿Lo tienen disponible?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full rounded-xl border border-white/30 px-4 py-3 text-center text-sm transition hover:bg-white/10"
            >
              Consultar por WhatsApp
            </a>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/20 p-4">
            <p className="text-sm font-semibold">Retirás en el local</p>
            <p className="mt-1 text-xs text-white/80">{c.direccion}</p>
            <p className="mt-1 text-xs text-white/80">Horario de atención: {horario(c.abre, c.cierra)}</p>
          </div>
        </div>
      </div>

      {hermanos && hermanos.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Variantes de {p.grupo}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {hermanos.map((h) => (
              <Link
                key={h.id}
                href={`/producto/${h.id}`}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${h.id === p.id ? "border-white bg-white font-semibold text-marino" : "border-white/40 hover:bg-white/10"}`}
              >
                {h.nombre}
                {h.precio != null ? ` · ${plata(h.precio)}` : ""}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{p.descripcion || "Este producto todavía no tiene descripción cargada."}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Características</h2>
        <dl className="mt-2 max-w-xl">
          {fila("Comercio", c.nombre)}
          {fila("Rubro", c.rubro)}
          {p.marca ? fila("Marca", p.marca) : null}
          {fila("Disponibilidad", d.texto)}
          {fila("Precio", plata(p.precio))}
          {fila("Horario de atención", horario(c.abre, c.cierra))}
          {fila("Valoración del comercio", prom != null ? `${nota(prom)} de 5` : "Sin reseñas")}
        </dl>
      </section>

      {masProductos.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Más productos de {c.nombre}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {masProductos.map((o) => (
              <Link key={o.id} href={`/producto/${o.id}`} className="rounded-2xl border border-white/20 p-4 transition hover:-translate-y-0.5 hover:border-white/60">
                <p className="text-sm font-semibold">{o.nombre}</p>
                <p className="mt-1 text-sm text-white/80">{plata(o.precio)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

// Formulario de reserva si hay sesión; si no, un botón que lleva a ingresar
// y vuelve a este producto.
async function Reserva(props: React.ComponentProps<typeof FormReserva>) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return (
      <>
        <Link
          href={`/ingresar?siguiente=${encodeURIComponent(`/producto/${props.productoId}`)}`}
          className="boton mt-5 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold"
        >
          {props.textoBoton}
        </Link>
        <p className="mt-2 text-xs text-white/75">Para reservar ingresá o creá tu cuenta. Te lleva un minuto.</p>
      </>
    );
  }
  return <FormReserva {...props} />;
}
