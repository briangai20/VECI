import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { FormularioCuenta } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  return (
    <Suspense fallback={<div className="tarjeta mx-auto h-96 max-w-md animate-pulse rounded-3xl" />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const sp = await searchParams;
  const siguiente = typeof sp.siguiente === "string" && sp.siguiente.startsWith("/") && !sp.siguiente.startsWith("//") ? sp.siguiente : "/";
  if (await usuarioActual()) redirect(siguiente);
  const error = sp.error === "link" ? "El link de confirmación venció o ya se usó. Probá ingresar o pedí otro." : null;
  return (
    <>
      {error ? <p className="mx-auto mb-4 max-w-md rounded-2xl bg-marino p-4 text-sm text-white">{error}</p> : null}
      <FormularioCuenta siguiente={siguiente} modoInicial={sp.modo === "crear" ? "crear" : "ingresar"} />
    </>
  );
}
