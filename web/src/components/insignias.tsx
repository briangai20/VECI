import type { Disponibilidad } from "@/lib/formato";

export function Estrellas({ valor, className = "text-sm" }: { valor: number | null; className?: string }) {
  const llenas = Math.round(valor ?? 0);
  return (
    <span className={`${className} tracking-tight whitespace-nowrap`} aria-label={valor ? `${valor.toFixed(1)} de 5` : "Sin reseñas"}>
      <span className="text-estrella">{"★".repeat(llenas)}</span>
      <span className="text-white/35">{"★".repeat(5 - llenas)}</span>
    </span>
  );
}

export function Abierto({ abierto }: { abierto: boolean | null }) {
  if (abierto == null) return null;
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-white ${abierto ? "border-white" : "border-white/40"}`}
    >
      {abierto ? "Abierto" : "Cerrado"}
    </span>
  );
}

const BORDE: Record<Disponibilidad["tono"], string> = {
  ok: "border-white",
  poco: "border-white/70",
  no: "border-white/40 line-through",
  consultar: "border-dashed border-white/70",
};

export function Stock({ d }: { d: Disponibilidad }) {
  return (
    <span className={`rounded-full border bg-marino-claro px-2.5 py-0.5 text-[11px] font-semibold text-white ${BORDE[d.tono]}`}>
      {d.texto}
    </span>
  );
}
