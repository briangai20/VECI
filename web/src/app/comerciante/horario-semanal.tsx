"use client";

import { useState } from "react";
import { DIAS, type Franja } from "@/lib/formato";

type Dia = { abre: boolean; a1: string; c1: string; cortado: boolean; a2: string; c2: string };

const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // de lunes a domingo
const hhmm = (t: string) => t.slice(0, 5);

function inicial(franjas: Franja[]): Dia[] {
  return DIAS.map((_, dia) => {
    const del = franjas.filter((f) => f.dia === dia).sort((x, y) => x.abre.localeCompare(y.abre));
    if (!franjas.length) {
      // Sugerencia para un comercio nuevo: lunes a sábado de 9 a 19.
      return { abre: dia !== 0, a1: "09:00", c1: "19:00", cortado: false, a2: "16:00", c2: "20:00" };
    }
    return {
      abre: del.length > 0,
      a1: del[0] ? hhmm(del[0].abre) : "09:00",
      c1: del[0] ? hhmm(del[0].cierra) : "13:00",
      cortado: del.length > 1,
      a2: del[1] ? hhmm(del[1].abre) : "16:00",
      c2: del[1] ? hhmm(del[1].cierra) : "20:00",
    };
  });
}

// Editor del horario de atención. Manda los campos h{dia}on, h{dia}a1,
// h{dia}c1 y, si tiene horario cortado, h{dia}a2 y h{dia}c2.
export function HorarioSemanal({ franjas, abreFeriados }: { franjas: Franja[]; abreFeriados: boolean }) {
  const [dias, setDias] = useState(() => inicial(franjas));
  const cambiar = (dia: number, parcial: Partial<Dia>) => setDias((d) => d.map((x, i) => (i === dia ? { ...x, ...parcial } : x)));
  const copiarLunes = () => setDias((d) => d.map((x, i) => (i >= 2 && i <= 5 ? { ...d[1] } : x)));

  return (
    <fieldset className="rounded-2xl border border-white/20 p-4">
      <legend className="px-1 text-xs">Horario de atención</legend>
      <p className="text-xs text-white/75">
        Los vecinos ven si estás abierto y eligen el retiro dentro de este horario. Las reservas que llegan con el local cerrado empiezan a contar
        cuando abrís.
      </p>
      <div className="mt-3 space-y-2">
        {ORDEN.map((dia) => {
          const d = dias[dia];
          return (
            <div key={dia} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input type="checkbox" name={`h${dia}on`} checked={d.abre} onChange={(e) => cambiar(dia, { abre: e.target.checked })} className="h-4 w-4 accent-white" />
                {DIAS[dia]}
              </label>
              {d.abre ? (
                <>
                  <span className="flex items-center gap-1">
                    <input type="time" name={`h${dia}a1`} value={d.a1} onChange={(e) => cambiar(dia, { a1: e.target.value })} aria-label={`${DIAS[dia]}: abre`} className="campo w-28 py-1.5" />
                    a
                    <input type="time" name={`h${dia}c1`} value={d.c1} onChange={(e) => cambiar(dia, { c1: e.target.value })} aria-label={`${DIAS[dia]}: cierra`} className="campo w-28 py-1.5" />
                  </span>
                  {d.cortado ? (
                    <span className="flex items-center gap-1">
                      y
                      <input type="time" name={`h${dia}a2`} value={d.a2} onChange={(e) => cambiar(dia, { a2: e.target.value })} aria-label={`${DIAS[dia]}: vuelve a abrir`} className="campo w-28 py-1.5" />
                      a
                      <input type="time" name={`h${dia}c2`} value={d.c2} onChange={(e) => cambiar(dia, { c2: e.target.value })} aria-label={`${DIAS[dia]}: cierra a la tarde`} className="campo w-28 py-1.5" />
                    </span>
                  ) : null}
                  <button type="button" onClick={() => cambiar(dia, { cortado: !d.cortado })} className="text-xs text-white/80 underline">
                    {d.cortado ? "Sin cortar al mediodía" : "Cierro al mediodía"}
                  </button>
                </>
              ) : (
                <span className="text-white/60">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={copiarLunes} className="mt-3 rounded-lg border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10">
        Copiar el horario del lunes de martes a viernes
      </button>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" name="abre_feriados" defaultChecked={abreFeriados} className="mt-0.5 h-4 w-4 accent-white" />
        <span>
          Abro los feriados nacionales
          <span className="block text-xs text-white/70">Si no lo marcás, los feriados figurás cerrado y las reservas esperan al día siguiente que abrís.</span>
        </span>
      </label>
    </fieldset>
  );
}
