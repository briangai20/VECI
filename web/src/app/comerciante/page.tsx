import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { plata } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Enum } from "@/lib/supabase/tipos";
import { cambiarReserva } from "./acciones";
import { FormComercio } from "./form-comercio";
import { ProductoFila } from "./producto-fila";

export const metadata: Metadata = { title: "Panel del comerciante" };

export default function PaginaComerciante() {
  return (
    <Suspense fallback={<div className="tarjeta h-96 animate-pulse rounded-3xl" />}>
      <Panel />
    </Suspense>
  );
}

const ESTADOS: Record<Enum<"estado_reserva">, string> = {
  pendiente: "Para responder",
  alternativa: "Esperando al cliente",
  aceptada: "Aceptada: falta retirar",
  retirada: "Retirada",
  rechazada: "Rechazada",
  cancelada: "Cancelada por el cliente",
  vencida: "Vencida",
};

async function Panel() {
  const usuario = await usuarioActual();

  if (!usuario) {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-2xl font-bold">Sumá tu comercio a VECI</h1>
        <p className="mt-2 text-sm text-white/85">
          Publicá tus productos con precio y stock, recibí reservas de vecinos de tu zona y que te retiren en el local. Los primeros 3 meses son gratis.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/ingresar?modo=crear&siguiente=/comerciante" className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
            Crear cuenta de comerciante
          </Link>
          <Link href="/ingresar?siguiente=/comerciante" className="rounded-xl border border-white/40 px-5 py-2.5 text-sm hover:bg-white/10">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    );
  }

  if (usuario.rol !== "comerciante") {
    return (
      <div className="tarjeta mx-auto max-w-xl rounded-3xl p-8 text-center">
        <h1 className="text-xl font-bold">Tu cuenta es de comprador</h1>
        <p className="mt-2 text-sm text-white/85">
          Para publicar un comercio necesitás una cuenta de comerciante. Salí y creá una nueva con otro mail, o escribinos para cambiar la tuya.
        </p>
      </div>
    );
  }

  const supabase = await supabaseServidor();
  const [{ data: comercio }, { data: zonas }] = await Promise.all([
    supabase.from("comercios").select("*").eq("dueno_id", usuario.id).order("id").limit(1).maybeSingle(),
    supabase.from("zonas").select("*").order("nombre"),
  ]);

  if (!comercio) {
    return (
      <div className="tarjeta rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Hola{usuario.nombre ? `, ${usuario.nombre.split(" ")[0]}` : ""}. Cargá tu comercio</h1>
        <p className="mt-1 mb-6 text-sm text-white/85">Con estos datos te encuentran los vecinos. Después cargás los productos.</p>
        <FormComercio comercio={null} zonas={zonas ?? []} />
      </div>
    );
  }

  const [{ data: productos }, { data: reservas }, { data: stats }] = await Promise.all([
    supabase.from("productos").select("*").eq("comercio_id", comercio.id).order("nombre"),
    supabase
      .from("reservas")
      .select("*, comprador:perfiles!reservas_comprador_id_fkey(nombre, telefono)")
      .eq("comercio_id", comercio.id)
      .order("creada_en", { ascending: false })
      .limit(30),
    supabase.rpc("estadisticas_comercio", { p_comercio: comercio.id }),
  ]);
  const s = stats?.[0];
  const ahora = new Date();
  const abiertas = (reservas ?? []).filter((r) => r.estado === "pendiente" || r.estado === "aceptada");
  const cerradas = (reservas ?? []).filter((r) => !(r.estado === "pendiente" || r.estado === "aceptada"));

  return (
    <div className="space-y-6">
      {!comercio.aprobado ? (
        <p className="rounded-2xl border border-naranja bg-naranja/10 p-4 text-sm">
          <span className="font-semibold">Tu comercio está en revisión.</span> Mientras tanto podés cargar productos; los vecinos lo van a ver cuando lo publiquemos.
        </p>
      ) : null}

      <div className="tarjeta rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Panel de {comercio.nombre}</h1>
            <p className="text-sm text-white/80">
              {productos?.length ?? 0} productos · {comercio.direccion}
            </p>
          </div>
          {comercio.aprobado ? (
            <Link href={`/comercio/${comercio.id}`} className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
              Ver como cliente
            </Link>
          ) : null}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Vistas (7 días)", s?.total_vistas ?? 0],
            ["Reservas (7 días)", s?.total_reservas ?? 0],
            ["Retiradas (7 días)", s?.total_retiradas ?? 0],
            ["Valoración", s?.promedio_estrellas ? `${String(s.promedio_estrellas).replace(".", ",")} (${s.total_resenas})` : "Sin reseñas"],
          ].map(([t, v]) => (
            <div key={t} className="rounded-2xl border border-white/20 p-4">
              <p className="text-xs text-white/75">{t}</p>
              <p className="mt-1 text-2xl font-black">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <section id="reservas" className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Reservas</h2>
        {abiertas.length === 0 ? (
          <p className="mt-3 text-sm text-white/80">No tenés reservas para responder. Aparecen acá en cuanto un vecino reserve.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {abiertas.map((r) => (
              <article key={r.id} className="rounded-2xl border border-white/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.producto_nombre} × {r.cantidad}
                    </p>
                    <p className="text-xs text-white/75">
                      {r.comprador?.nombre || "Cliente"} · Retira: {r.retiro} · {r.medio_pago === "online" ? "Pagó online" : "Paga en el local"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/40 px-2.5 py-0.5 text-[11px] font-semibold">{ESTADOS[r.estado]}</span>
                </div>
                <p className="mt-2 text-sm">Total: {plata(r.precio_unitario == null ? null : r.precio_unitario * r.cantidad)}</p>
                <form action={cambiarReserva} className="mt-3 flex gap-2">
                  <input type="hidden" name="reserva" value={r.id} />
                  {r.estado === "pendiente" ? (
                    <>
                      <button name="accion" value="aceptar" className="boton flex-1 rounded-xl py-2 text-sm font-semibold">
                        Aceptar
                      </button>
                      <button name="accion" value="rechazar" className="flex-1 rounded-xl border border-white/40 py-2 text-sm hover:bg-white/10">
                        Rechazar
                      </button>
                    </>
                  ) : (
                    <button name="accion" value="retirada" className="flex-1 rounded-xl border border-white/60 py-2 text-sm font-semibold hover:bg-white/10">
                      Ya lo retiró
                    </button>
                  )}
                </form>
              </article>
            ))}
          </div>
        )}
        {cerradas.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-white/80">Historial ({cerradas.length})</summary>
            <ul className="mt-2 divide-y divide-white/10">
              {cerradas.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {r.producto_nombre} × {r.cantidad} · {r.comprador?.nombre || "Cliente"}
                  </span>
                  <span className="text-white/70">{ESTADOS[r.estado]}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section id="productos" className="tarjeta rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Productos</h2>
        <p className="mt-1 text-sm text-white/80">
          Mantené el stock al día: si no lo tocás en 7 días (3 si usás hay/poco), el producto aparece como &quot;Sin verificar&quot;.
        </p>
        <div className="mt-4 space-y-3">
          <ProductoFila comercioId={comercio.id} ahora={ahora} />
          {(productos ?? []).map((p) => (
            <ProductoFila key={p.id} p={p} comercioId={comercio.id} ahora={ahora} />
          ))}
        </div>
      </section>

      <section id="datos" className="tarjeta rounded-3xl p-6">
        <h2 className="mb-4 text-lg font-semibold">Datos del comercio</h2>
        <FormComercio comercio={comercio} zonas={zonas ?? []} />
      </section>
    </div>
  );
}
