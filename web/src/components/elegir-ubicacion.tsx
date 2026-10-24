"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapaMapLibre, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

type Punto = { lat: number; lng: number };

// Mapa para que el comerciante marque su local: arrastra el pin, toca el
// mapa o usa su ubicación. Manda lat y lng como campos ocultos del formulario.
export function ElegirUbicacion({ inicial, centroZona }: { inicial: Punto | null; centroZona: Punto }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapLibre | null>(null);
  const pin = useRef<Marker | null>(null);
  const [punto, setPunto] = useState<Punto | null>(inicial);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let cancelado = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelado || !contenedor.current) return;
      const inicio = inicial ?? centroZona;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); // ver scripts/copiar-worker-mapa.mjs
      const m = new maplibregl.Map({
        container: contenedor.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [inicio.lng, inicio.lat],
        zoom: inicial ? 16 : 13,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.scrollZoom.disable();
      const el = document.createElement("div");
      el.className = "h-8 w-8 rounded-full border-4 border-white bg-naranja shadow-lg";
      const marcador = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([inicio.lng, inicio.lat]);
      if (inicial) marcador.addTo(m);
      marcador.on("dragend", () => {
        const p = marcador.getLngLat();
        setPunto({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        marcador.setLngLat(e.lngLat).addTo(m);
        setPunto({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      mapa.current = m;
      pin.current = marcador;
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si cambia la zona y todavía no marcó nada, llevamos el mapa a esa zona.
  useEffect(() => {
    if (!punto) mapa.current?.jumpTo({ center: [centroZona.lng, centroZona.lat], zoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroZona.lat, centroZona.lng]);

  function usarMiUbicacion() {
    if (!navigator.geolocation) return setAviso("Tu navegador no permite compartir la ubicación.");
    setAviso("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAviso("Revisá que el pin quede en la puerta de tu local.");
        setPunto(p);
        if (mapa.current && pin.current) {
          pin.current.setLngLat([p.lng, p.lat]).addTo(mapa.current);
          mapa.current.jumpTo({ center: [p.lng, p.lat], zoom: 17 });
        }
      },
      () => setAviso("No pudimos acceder a tu ubicación. Marcá el local tocando el mapa."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs">Ubicación del local en el mapa</span>
        <button type="button" onClick={usarMiUbicacion} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10">
          Estoy en el local: usar mi ubicación
        </button>
      </div>
      <div ref={contenedor} className="mt-2 h-72 w-full overflow-hidden rounded-2xl border border-white/20 bg-[#d8d1c4]" />
      <p className="mt-2 text-xs text-white/80" role="status">
        {aviso || (punto ? "Podés arrastrar el pin para ajustarlo." : "Tocá el mapa en la puerta de tu local.")}
      </p>
      <input type="hidden" name="lat" value={punto?.lat ?? ""} />
      <input type="hidden" name="lng" value={punto?.lng ?? ""} />
    </div>
  );
}
