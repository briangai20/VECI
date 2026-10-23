"use client";

import { useSyncExternalStore } from "react";

const nada = () => () => {};

// true recién cuando la página ya es interactiva en el navegador. Los
// formularios que se envían con onSubmit deshabilitan el botón hasta
// entonces: si no, un toque temprano manda el formulario "a la antigua"
// (con los datos en la dirección) y no se guarda nada.
export function useListo() {
  return useSyncExternalStore(
    nada,
    () => true,
    () => false,
  );
}
