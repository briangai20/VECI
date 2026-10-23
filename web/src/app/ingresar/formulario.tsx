"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ingresar, registrarse, type EstadoCuenta } from "./acciones";

export function FormularioCuenta({ siguiente, modoInicial }: { siguiente: string; modoInicial: "ingresar" | "crear" }) {
  const [modo, setModo] = useState(modoInicial);
  const [estadoIngreso, accionIngreso, ingresando] = useActionState<EstadoCuenta, FormData>(ingresar, {});
  const [estadoAlta, accionAlta, creando] = useActionState<EstadoCuenta, FormData>(registrarse, {});
  const estado = modo === "ingresar" ? estadoIngreso : estadoAlta;

  return (
    <div className="tarjeta mx-auto max-w-md rounded-3xl p-6">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/20 p-1" role="tablist">
        {(["ingresar", "crear"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${modo === m ? "bg-white text-marino" : "hover:bg-white/10"}`}
          >
            {m === "ingresar" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      {modo === "ingresar" ? (
        <form key={JSON.stringify(estadoIngreso.valores ?? {})} action={accionIngreso} className="mt-6 space-y-4">
          <input type="hidden" name="siguiente" value={siguiente} />
          <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" defaultValue={estado.valores?.email} />
          <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" />
          <button disabled={ingresando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
            {ingresando ? "Ingresando…" : "Ingresar"}
          </button>
          <Link href="/recuperar" className="block text-center text-sm text-white/80 underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      ) : (
        <form key={JSON.stringify(estadoAlta.valores ?? {})} action={accionAlta} className="mt-6 space-y-4">
          <input type="hidden" name="siguiente" value={siguiente} />
          <fieldset>
            <legend className="text-xs">Quiero usar VECI para…</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { v: "comprador", t: "Comprar", d: "Buscar y reservar productos" },
                { v: "comerciante", t: "Vender", d: "Publicar mi comercio" },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/25 p-3 text-sm has-[:checked]:border-white has-[:checked]:bg-marino-claro"
                >
                  <input type="radio" name="rol" value={o.v} defaultChecked={o.v === (estadoAlta.valores?.rol ?? (siguiente.startsWith("/comerciante") ? "comerciante" : "comprador"))} className="mt-1 accent-white" />
                  <span>
                    <span className="font-semibold">{o.t}</span>
                    <span className="block text-xs text-white/75">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Campo etiqueta="Tu nombre y apellido" name="nombre" autoComplete="name" defaultValue={estadoAlta.valores?.nombre} />
          <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" defaultValue={estado.valores?.email} />
          <Campo etiqueta="Contraseña (mínimo 8 caracteres)" name="password" type="password" autoComplete="new-password" minLength={8} />
          <button disabled={creando} className="boton w-full rounded-xl px-4 py-3 text-sm font-semibold">
            {creando ? "Creando la cuenta…" : "Crear cuenta"}
          </button>
        </form>
      )}

      <p role="status" className="mt-4 min-h-5 text-sm">
        {estado.error ? <span className="text-[#ffb4a2]">{estado.error}</span> : estado.aviso}
      </p>
    </div>
  );
}

function Campo({ etiqueta, ...props }: { etiqueta: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-xs">
      {etiqueta}
      <input required className="campo mt-1" {...props} />
    </label>
  );
}
