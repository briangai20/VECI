"use client";

import { startTransition, useActionState } from "react";
import { reservar, type EstadoReserva } from "@/app/reservas/acciones";
import { useListo } from "@/components/use-listo";

type Props = {
  productoId: number;
  maximo: number;
  franjas: string[];
  textoBoton: string;
  precio: number | null;
};

export function FormReserva({ productoId, maximo, franjas, textoBoton, precio }: Props) {
  const [estado, accion, enviando] = useActionState<EstadoReserva, FormData>(reservar, {});
  const listo = useListo();

  return (
    <form
      // Se envía a mano para que, si hay un error, no se borre lo elegido.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="mt-5"
    >
      <input type="hidden" name="producto" value={productoId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          Cantidad
          <select name="cantidad" className="campo mt-1">
            {Array.from({ length: maximo }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Horario de retiro
          <select name="retiro" className="campo mt-1">
            {franjas.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-white/80">
        Pagás en el local al retirar{precio == null ? " (el precio te lo confirma el comercio)" : ""}. El pago online con Mercado Pago llega pronto.
      </p>
      <button disabled={enviando || !listo} className="boton mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold">
        {enviando ? "Reservando…" : textoBoton}
      </button>
      <p role="status" className="mt-2 min-h-5 text-sm text-[#ffb4a2]">
        {estado.error}
      </p>
    </form>
  );
}
