import { fechaAR } from "@/lib/formato";

type Cierre = { fecha: string; motivo: string };

const corta = (f: string) => `${Number(f.slice(8))}/${Number(f.slice(5, 7))}`;

// "Hoy cerrado: Feriado…" y los próximos días que el comercio no abre.
export function AvisoCierres({ cierres, ahora }: { cierres: Cierre[]; ahora: Date }) {
  const hoy = fechaAR(ahora);
  const deHoy = cierres.find((c) => c.fecha === hoy);
  const proximos = cierres.filter((c) => c.fecha > hoy && c.fecha <= fechaAR(ahora, 14));
  if (!deHoy && !proximos.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-naranja bg-naranja/15 px-3 py-2 text-xs">
      {deHoy ? (
        <p>
          <span className="font-semibold">Hoy cerrado</span> ({deHoy.motivo}).
        </p>
      ) : null}
      {proximos.length ? (
        <p>
          Próximos días cerrados: {proximos.map((c) => `${corta(c.fecha)} (${c.motivo})`).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
