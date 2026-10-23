"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cambiarClave, type EstadoCuenta } from "../ingresar/acciones";

export function FormNuevaClave({ email, destino }: { email: string; destino: string }) {
  const [estado, accion, guardando] = useActionState<EstadoCuenta, FormData>(cambiarClave, {});
  if (estado.aviso) {
    return (
      <div className="mt-5">
        <p className="text-sm">{estado.aviso}</p>
        <Link href={destino} className="boton mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold">
          Seguir
        </Link>
      </div>
    );
  }
  return (
    <form action={accion} className="mt-5 space-y-4">
      <p className="text-sm text-white/80">Cuenta: {email}</p>
      <input type="email" name="usuario" autoComplete="username" value={email} readOnly hidden />
      <label className="block text-xs">
        Contraseña nueva (mínimo 8 caracteres)
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="campo mt-1" />
      </label>
      <label className="block text-xs">
        Repetila
        <input name="repetida" type="password" required minLength={8} autoComplete="new-password" className="campo mt-1" />
      </label>
      <button disabled={guardando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
        {guardando ? "Guardando…" : "Guardar contraseña"}
      </button>
      <p role="status" className="min-h-5 text-sm text-[#ffb4a2]">
        {estado.error}
      </p>
    </form>
  );
}
