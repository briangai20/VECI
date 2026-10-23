import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/sesion";
import { FormNuevaClave } from "./formulario";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default function PaginaNuevaClave() {
  return (
    <div className="tarjeta mx-auto max-w-md rounded-3xl p-6">
      <h1 className="text-xl font-bold">Elegí tu contraseña nueva</h1>
      <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-xl bg-white/5" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

// Se llega desde el link del mail, que ya inició la sesión (ver /auth/callback).
async function Contenido() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/recuperar");
  return <FormNuevaClave email={usuario.email} destino={usuario.rol === "comerciante" ? "/comerciante" : "/"} />;
}
