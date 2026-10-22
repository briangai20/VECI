"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Zona = { id: string; nombre: string };

export type ValoresFiltro = {
  q: string;
  zona: string;
  radio: number;
  lat?: number;
  lng?: number;
};

function armarUrl(v: ValoresFiltro) {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.lat != null && v.lng != null) {
    p.set("lat", v.lat.toFixed(5));
    p.set("lng", v.lng.toFixed(5));
  } else {
    p.set("zona", v.zona);
  }
  p.set("radio", String(v.radio));
  return "/?" + p.toString();
}

export function Filtros({ zonas, inicial }: { zonas: Zona[]; inicial: ValoresFiltro }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [v, setV] = useState(inicial);
  const [aviso, setAviso] = useState("");

  // La búsqueda por texto espera a que se deje de escribir.
  useEffect(() => {
    if (v.q === inicial.q) return;
    const t = setTimeout(() => ir({ ...v }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.q]);

  function ir(nuevo: ValoresFiltro) {
    startTransition(() => router.replace(armarUrl(nuevo), { scroll: false }));
  }

  function cambiar(parcial: Partial<ValoresFiltro>, navegar = true) {
    const nuevo = { ...v, ...parcial };
    setV(nuevo);
    if (navegar) ir(nuevo);
  }

  function usarUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no permite compartir la ubicación.");
      return;
    }
    setAviso("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAviso("");
        cambiar({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setAviso("No pudimos acceder a tu ubicación. Elegí una zona."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const conUbicacion = v.lat != null && v.lng != null;

  return (
    <div className="tarjeta rounded-3xl p-5" aria-busy={pendiente}>
      <h2 className="text-xs font-semibold tracking-wider uppercase">Filtros</h2>

      <label htmlFor="q" className="mt-4 block text-xs">
        Producto o rubro
      </label>
      <input
        id="q"
        type="search"
        autoComplete="off"
        placeholder="Mercería, tornillos, zapatillas..."
        value={v.q}
        onChange={(e) => cambiar({ q: e.target.value }, false)}
        className="campo mt-1"
      />

      <label htmlFor="zona" className="mt-4 block text-xs">
        Ubicación
      </label>
      <select
        id="zona"
        value={conUbicacion ? "__yo" : v.zona}
        onChange={(e) => {
          if (e.target.value === "__yo") return usarUbicacion();
          cambiar({ zona: e.target.value, lat: undefined, lng: undefined });
        }}
        className="campo mt-1"
      >
        <option value="__yo">{conUbicacion ? "Mi ubicación actual" : "Usar mi ubicación actual"}</option>
        {zonas.map((z) => (
          <option key={z.id} value={z.id}>
            {z.nombre}
          </option>
        ))}
      </select>
      <p className="mt-2 min-h-5 text-xs text-white/80" role="status">
        {aviso}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <label htmlFor="radio" className="text-xs">
          Radio de búsqueda
        </label>
        <span className="rounded-lg border border-white/25 bg-marino-claro px-2.5 py-1 text-xs font-bold">{v.radio} km</span>
      </div>
      <input
        id="radio"
        type="range"
        min={1}
        max={20}
        value={v.radio}
        onChange={(e) => cambiar({ radio: Number(e.target.value) }, false)}
        onPointerUp={() => ir(v)}
        onKeyUp={() => ir(v)}
        className="mt-2 w-full"
      />
      <div className="mt-1 flex justify-between text-[11px]">
        <span>1 km</span>
        <span>20 km</span>
      </div>
    </div>
  );
}
