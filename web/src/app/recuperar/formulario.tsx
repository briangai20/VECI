"use client";

import { useActionState } from "react";
import { pedirNuevaClave, type EstadoCuenta } from "../ingresar/acciones";

export function FormRecuperar() {
  const [estado, accion, enviando] = useActionState<EstadoCuenta, FormData>(pedirNuevaClave, {});
  return (
    <form action={accion} className="mt-5 space-y-4">
      <label className="block text-xs">
        Mail
        <input name="email" type="email" required autoComplete="email" defaultValue={estado.valores?.email} className="campo mt-1" />
      </label>
      <button disabled={enviando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
        {enviando ? "Enviando…" : "Mandarme el link"}
      </button>
      <p role="status" className="min-h-5 text-sm">
        {estado.error ? <span className="text-[#ffb4a2]">{estado.error}</span> : estado.aviso}
      </p>
    </form>
  );
}
