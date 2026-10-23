"use client";

import { startTransition, useActionState, useState } from "react";
import { ElegirUbicacion } from "@/components/elegir-ubicacion";
import { useListo } from "@/components/use-listo";
import type { Tabla } from "@/lib/supabase/tipos";
import { CENTROS, ZONA_INICIAL } from "@/lib/zonas";
import type { Franja } from "@/lib/formato";
import { guardarComercio, type Estado } from "./acciones";
import { HorarioSemanal } from "./horario-semanal";

const RUBROS = ["Ferretería", "Mercería", "Herrajes", "Librería", "Kiosco", "Almacén", "Farmacia", "Indumentaria", "Bazar", "Electricidad", "Pinturería"];

export function FormComercio({ comercio, zonas, franjas }: { comercio: Tabla<"comercios"> | null; zonas: Tabla<"zonas">[]; franjas: Franja[] }) {
  const [estado, accion, guardando] = useActionState<Estado, FormData>(guardarComercio, {});
  const listo = useListo();
  const [zona, setZona] = useState(comercio?.zona_id ?? ZONA_INICIAL);

  return (
    <form
      // Se envía a mano (no con action=) para que React no vacíe el formulario si hay un error.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      {comercio ? <input type="hidden" name="id" value={comercio.id} /> : null}
      <label className="block text-xs">
        Nombre del comercio
        <input name="nombre" required defaultValue={comercio?.nombre} className="campo mt-1" />
      </label>
      <label className="block text-xs">
        Rubro
        <input name="rubro" required list="rubros" defaultValue={comercio?.rubro} className="campo mt-1" placeholder="Ferretería, mercería…" />
        <datalist id="rubros">
          {RUBROS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <label className="block text-xs">
        Dirección (calle y número)
        <input name="direccion" required defaultValue={comercio?.direccion} className="campo mt-1" placeholder="San Martín 780" />
      </label>
      <label className="block text-xs">
        Zona
        <select name="zona_id" value={zona} onChange={(e) => setZona(e.target.value)} className="campo mt-1">
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        WhatsApp para consultas (opcional)
        <input name="whatsapp" type="tel" defaultValue={comercio?.whatsapp ?? ""} className="campo mt-1" placeholder="11 2345 6789" />
      </label>
      <div className="md:col-span-2">
        <HorarioSemanal franjas={franjas} />
      </div>
      <div className="md:col-span-2">
        <ElegirUbicacion
          inicial={comercio?.lat != null && comercio?.lng != null ? { lat: comercio.lat, lng: comercio.lng } : null}
          centroZona={CENTROS[zona] ?? CENTROS[ZONA_INICIAL]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button disabled={guardando || !listo} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
          {guardando ? "Guardando…" : comercio ? "Guardar cambios" : "Crear mi comercio"}
        </button>
        <p role="status" className="text-sm">
          {estado.error ? <span className="text-[#ffb4a2]">{estado.error}</span> : estado.ok}
        </p>
      </div>
    </form>
  );
}
