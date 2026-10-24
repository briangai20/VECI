"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapaMapLibre, Marker } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { iniciales } from "@/lib/formato";

export type PuntoComercio = {
  id: number;
  nombre: string;
  rubro: string;
  direccion: string;
  lat: number;
  lng: number;
};

type Props = {
  centro: { lat: number; lng: number };
  comercios: PuntoComercio[];
  /** Dibuja el radio de búsqueda y el punto "Vos" en el centro. */
  radioKm?: number;
  /** Comercio resaltado (en su propia página). */
  seleccionado?: number;
  className?: string;
};

// Mapa gratuito de OpenFreeMap (datos de OpenStreetMap), sin clave.
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";

// Polígono aproximado de un círculo de radio km alrededor del centro.
function circulo(lat: number, lng: number, km: number, pasos = 64) {
  const coords: [number, number][] = [];
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= pasos; i++) {
    const a = (i / pasos) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

function pin(texto: string, resaltado: boolean) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = texto;
  el.className =
    "grid h-10 w-10 cursor-pointer place-items-center rounded-full border-2 border-white bg-marino text-xs font-black text-white shadow-lg transition-transform hover:scale-110" +
    (resaltado ? " ring-4 ring-naranja" : "");
  return el;
}

export function MapaComercios({ centro, comercios, radioKm, seleccionado, className = "h-[320px] sm:h-[420px]" }: Props) {
  const router = useRouter();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapLibre | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const [listo, setListo] = useState(false);

  // Crea el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelado || !contenedor.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); // ver scripts/copiar-worker-mapa.mjs
      const m = new maplibregl.Map({
        container: contenedor.current,
        style: ESTILO,
        center: [centro.lng, centro.lat],
        zoom: 13,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.scrollZoom.disable(); // que la rueda siga moviendo la página; se acerca con los botones o con dos dedos
      mapa.current = m;
      m.on("load", () => setListo(true));
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dibujar() {
    const m = mapa.current;
    if (!m) return;
    const maplibregl = await import("maplibre-gl");

    marcadores.current.forEach((x) => x.remove());
    marcadores.current = [];

    if (radioKm) {
      const datos = circulo(centro.lat, centro.lng, radioKm);
      const fuente = m.getSource("radio") as GeoJSONSource | undefined;
      if (fuente) fuente.setData(datos);
      else {
        m.addSource("radio", { type: "geojson", data: datos });
        m.addLayer({ id: "radio-relleno", type: "fill", source: "radio", paint: { "fill-color": "#14213D", "fill-opacity": 0.08 } });
        m.addLayer({
          id: "radio-borde",
          type: "line",
          source: "radio",
          paint: { "line-color": "#14213D", "line-width": 2, "line-dasharray": [2, 2] },
        });
      }
      const yo = document.createElement("div");
      yo.className = "h-4 w-4 rounded-full border-2 border-white bg-naranja shadow";
      yo.title = "Vos";
      marcadores.current.push(new maplibregl.Marker({ element: yo }).setLngLat([centro.lng, centro.lat]).addTo(m));
    }

    for (const c of comercios) {
      const el = pin(iniciales(c.nombre) || c.nombre.charAt(0), c.id === seleccionado);
      el.setAttribute("aria-label", c.nombre);

      const tarjeta = document.createElement("div");
      tarjeta.className = "text-marino";
      const nombre = document.createElement("p");
      nombre.className = "font-semibold";
      nombre.textContent = c.nombre;
      const detalle = document.createElement("p");
      detalle.className = "text-xs";
      detalle.textContent = `${c.rubro} · ${c.direccion}`;
      tarjeta.append(nombre, detalle);
      if (c.id !== seleccionado) {
        const ver = document.createElement("button");
        ver.type = "button";
        ver.className = "mt-2 rounded-lg bg-naranja px-3 py-1 text-xs font-semibold text-white";
        ver.textContent = "Ver catálogo";
        ver.onclick = () => router.push(`/comercio/${c.id}`);
        tarjeta.append(ver);
      }
      const ir = document.createElement("a");
      ir.className = "mt-1 block text-xs underline";
      ir.href = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
      ir.target = "_blank";
      ir.rel = "noopener noreferrer";
      ir.textContent = "Cómo llegar";
      tarjeta.append(ir);

      const popup = new maplibregl.Popup({ offset: 24, closeButton: false }).setDOMContent(tarjeta);
      marcadores.current.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).setPopup(popup).addTo(m));
    }

    // Encuadre: el radio completo, o el comercio y su zona.
    if (radioKm) {
      const dLat = radioKm / 111.32;
      const dLng = radioKm / (111.32 * Math.cos((centro.lat * Math.PI) / 180));
      m.fitBounds(
        [
          [centro.lng - dLng, centro.lat - dLat],
          [centro.lng + dLng, centro.lat + dLat],
        ],
        { padding: 24, duration: 0 },
      );
    } else {
      m.jumpTo({ center: [centro.lng, centro.lat], zoom: 15 });
    }
  }

  // Dibuja pines y radio cuando el mapa termina de cargar y cada vez que cambian los datos.
  useEffect(() => {
    if (listo) dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, centro.lat, centro.lng, radioKm, seleccionado, comercios]);

  return (
    <div
      ref={contenedor}
      className={`w-full overflow-hidden rounded-2xl border border-white/20 bg-[#d8d1c4] ${className}`}
      role="region"
      aria-label="Mapa de comercios"
    />
  );
}
