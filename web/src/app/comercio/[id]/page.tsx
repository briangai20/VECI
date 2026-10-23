import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FotoProducto } from "@/components/foto-producto";
import { Abierto, Estrellas, Stock } from "@/components/insignias";
import { MapaComercios } from "@/components/mapa-comercios";
import { RegistrarVista } from "@/components/registrar-vista";
import { abiertoAhora, disponibilidad, horario, nota, plata, promedio } from "@/lib/formato";
import { supabasePublico } from "@/lib/supabase/publico";
import type { Tabla } from "@/lib/supabase/tipos";

type Props = PageProps<"/comercio/[id]">;

const sinAcentos = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function PaginaComercio({ params, searchParams }: Props) {
  return (
    <div className="tarjeta rounded-3xl p-5">
      <Suspense fallback={<p className="py-10 text-center text-sm text-white/80">Cargando el comercio…</p>}>
        <Comercio params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Comercio({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const comercioId = Number(id);
  if (!Number.isInteger(comercioId) || comercioId <= 0) notFound();

  const db = supabasePublico();
  const [{ data: c }, { data: productos }, { data: resenas }] = await Promise.all([
    db.from("comercios").select("*").eq("id", comercioId).eq("aprobado", true).maybeSingle(),
    db.from("productos").select("*").eq("comercio_id", comercioId).eq("activo", true).order("nombre"),
    db.from("resenas").select("estrellas, texto, autor_nombre, creada_en").eq("comercio_id", comercioId).order("creada_en", { ascending: false }),
  ]);
  if (!c) notFound();

  const ahora = new Date();
  const prom = promedio((resenas ?? []).map((r) => r.estrellas));
  const todos = productos ?? [];
  const buscado = sinAcentos(q.trim());
  const visibles = todos.filter(
    (p) => !buscado || [p.nombre, p.descripcion, p.marca, p.grupo].some((v) => sinAcentos(v ?? "").includes(buscado)),
  );

  // Los productos con el mismo "grupo" se muestran como una tarjeta con variantes.
  const grupos = new Map<string, Tabla<"productos">[]>();
  for (const p of visibles) {
    const k = p.grupo || `#${p.id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }

  return (
    <>
      <RegistrarVista comercioId={c.id} />
      <Link href="/" className="text-sm text-white/80 transition hover:text-white">
        ‹ Volver a la búsqueda
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{c.nombre}</h1>
        <Abierto abierto={abiertoAhora(c.abre, c.cierra, ahora)} />
      </div>
      <p className="mt-1 text-sm text-white/80">
        {c.rubro} · {c.direccion} · Horario {horario(c.abre, c.cierra)}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
        <Estrellas valor={prom} />
        <span>{nota(prom) ?? "Sin reseñas"}</span>
        {resenas?.length ? <span>({resenas.length})</span> : null}
      </div>

      {c.lat != null && c.lng != null ? (
        <div className="mt-4">
          <MapaComercios
            centro={{ lat: c.lat, lng: c.lng }}
            seleccionado={c.id}
            comercios={[{ id: c.id, nombre: c.nombre, rubro: c.rubro, direccion: c.direccion, lat: c.lat, lng: c.lng }]}
            className="h-56"
          />
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-white/85 underline hover:text-white"
          >
            Cómo llegar
          </a>
        </div>
      ) : null}

      <form className="mt-6" role="search">
        <label htmlFor="catq" className="sr-only">
          Buscar un producto en {c.nombre}
        </label>
        <input id="catq" name="q" type="search" defaultValue={q} placeholder={`Buscar un producto en ${c.nombre}`} className="campo" />
      </form>
      <p className="mt-2 text-xs text-white/80">
        {buscado ? `${grupos.size} resultado${grupos.size === 1 ? "" : "s"} en este local` : `${todos.length} productos en este local`}
      </p>

      {grupos.size === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">
          {buscado ? `No encontramos "${q.trim()}" en este local. Probá con otra palabra.` : "Este comercio todavía no cargó productos."}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...grupos.values()].map((lista) =>
            lista.length > 1 ? <TarjetaGrupo key={lista[0].grupo} lista={lista} /> : <TarjetaProducto key={lista[0].id} p={lista[0]} ahora={ahora} />,
          )}
        </div>
      )}

      {resenas?.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Reseñas</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {resenas.slice(0, 6).map((r, i) => (
              <article key={i} className="rounded-2xl border border-white/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Estrellas valor={r.estrellas} />
                  <span className="text-xs text-white/70">{new Date(r.creada_en).toLocaleDateString("es-AR")}</span>
                </div>
                {r.texto ? <p className="mt-2 text-sm">{r.texto}</p> : null}
                <p className="mt-2 text-xs text-white/70">{r.autor_nombre}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function TarjetaProducto({ p, ahora }: { p: Tabla<"productos">; ahora: Date }) {
  const d = disponibilidad(p, ahora);
  return (
    <Link href={`/producto/${p.id}`} className="group block overflow-hidden rounded-2xl border border-white/20 transition hover:-translate-y-0.5 hover:border-white/60">
      <div className="relative aspect-[4/3] overflow-hidden bg-marino-claro">
        <FotoProducto url={p.foto_url} nombre={p.nombre} sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute top-3 left-3">
          <Stock d={d} />
        </span>
      </div>
      <div className="p-4">
        {p.marca ? <p className="text-[11px] tracking-wider text-white/70 uppercase">{p.marca}</p> : null}
        <h3 className="leading-snug font-semibold">{p.nombre}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-white/75">{p.descripcion}</p>
        <p className="mt-3 text-xl font-black">{plata(p.precio)}</p>
        <span className="boton mt-4 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold">
          {!d.sePuede ? d.texto : d.requiereConfirmacion ? "Pedir reserva" : "Ver y reservar"}
        </span>
      </div>
    </Link>
  );
}

function TarjetaGrupo({ lista }: { lista: Tabla<"productos">[] }) {
  const primero = lista[0];
  const precios = lista.map((p) => p.precio).filter((v): v is number => v != null);
  const desde = precios.length ? Math.min(...precios) : null;
  const marcas = [...new Set(lista.map((p) => p.marca).filter(Boolean))];
  const conFoto = lista.find((p) => p.foto_url) ?? primero;
  return (
    <Link href={`/producto/${primero.id}`} className="group block overflow-hidden rounded-2xl border border-white/20 transition hover:-translate-y-0.5 hover:border-white/60">
      <div className="relative aspect-[4/3] overflow-hidden bg-marino-claro">
        <FotoProducto url={conFoto.foto_url} nombre={primero.grupo ?? primero.nombre} sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute top-3 left-3 rounded-full border border-white bg-marino px-2.5 py-0.5 text-[11px] font-semibold">
          {lista.length} variantes
        </span>
      </div>
      <div className="p-4">
        <h3 className="leading-snug font-semibold">{primero.grupo}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-white/75">{marcas.length ? marcas.join(" · ") : "Varias opciones"}</p>
        <p className="mt-3 text-xl font-black">
          {desde != null ? <span className="mr-1 text-xs font-normal text-white/80">Desde</span> : null}
          {plata(desde)}
        </p>
        <span className="boton mt-4 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold">Elegir variante</span>
      </div>
    </Link>
  );
}
