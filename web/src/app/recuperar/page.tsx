import type { Metadata } from "next";
import Link from "next/link";
import { FormRecuperar } from "./formulario";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperar() {
  return (
    <div className="tarjeta mx-auto max-w-md rounded-3xl p-6">
      <h1 className="text-xl font-bold">¿Olvidaste tu contraseña?</h1>
      <p className="mt-1 text-sm text-white/80">Escribí tu mail y te mandamos un link para elegir una nueva.</p>
      <FormRecuperar />
      <Link href="/ingresar" className="mt-4 inline-block text-sm text-white/80 underline">
        Volver a ingresar
      </Link>
    </div>
  );
}
