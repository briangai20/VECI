"use client";

import { useState, useTransition } from "react";
import { useListo } from "@/components/use-listo";
import { plata } from "@/lib/formato";
import { emparejar, interpretarPlanilla, type Celda, type FilaProducto, type ResultadoLectura } from "@/lib/importar";
import { importarProductos, type ResultadoImportacion } from "./acciones";

type Existente = { id: number; codigo: string | null; nombre: string };

const SEMAFORO = { hay: "Hay", poco: "Poco", no: "No hay" } as const;
const textoStock = (f: FilaProducto) =>
  f.modo === undefined
    ? "—"
    : f.modo === "exacto"
      ? String(f.stock ?? 0)
      : f.modo === "semaforo"
        ? SEMAFORO[f.semaforo ?? "hay"]
        : f.modo === "pedido"
          ? "A pedido"
          : "Consultar";

const EJEMPLO = [
  ["Código", "Producto", "Marca", "Precio", "Stock", "Descripción"],
  ["T-440", "Tornillos 4x40 (x100)", "Fischer", "2300", "20", "Acero galvanizado"],
  ["CI-20", "Cinta aisladora 20 m", "3M", "1.100,50", "poco", ""],
  ["LL-12", "Llave de paso 1/2", "", "", "a pedido", "Se prepara en 48 h"],
];

// CSV con ; y BOM: así lo abre bien el Excel en castellano, con acentos.
function descargarEjemplo() {
  const csv = "﻿" + EJEMPLO.map((f) => f.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "productos-veci.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

async function leerArchivo(archivo: File): Promise<Celda[][]> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(archivo)) as Celda[][];
  }
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    const { default: Papa } = await import("papaparse");
    return new Promise((ok, mal) =>
      Papa.parse<string[]>(archivo, { skipEmptyLines: "greedy", complete: (r) => ok(r.data), error: (e) => mal(e) }),
    );
  }
  throw new Error(nombre.endsWith(".xls") ? "xls" : "formato");
}

export function ImportarProductos({ comercioId, existentes }: { comercioId: number; existentes: Existente[] }) {
  const listo = useListo();
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [archivo, setArchivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [guardando, startTransition] = useTransition();

  async function elegir(f: File) {
    setResultado(null);
    setLectura(null);
    setArchivo(f.name);
    setAviso("Leyendo la planilla…");
    try {
      setLectura(interpretarPlanilla(await leerArchivo(f)));
      setAviso("");
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      setAviso(
        motivo === "xls"
          ? "Ese archivo es de un Excel viejo (.xls). Abrilo y guardalo como .xlsx o como CSV, y probá de nuevo."
          : motivo === "formato"
            ? "Subí un archivo de Excel (.xlsx) o CSV."
            : "No pudimos leer el archivo. Revisá que sea la planilla correcta.",
      );
    }
  }

  const pares = lectura ? emparejar(lectura.filas, existentes) : [];
  const nuevos = pares.filter((p) => !p.existente).length;
  const actualizar = pares.length - nuevos;

  function confirmar() {
    if (!lectura) return;
    startTransition(async () => {
      const r = await importarProductos(comercioId, lectura.filas);
      setResultado(r);
      if (!r.error) setLectura(null);
    });
  }

  return (
    <div>
      <p className="text-sm text-white/80">
        Subí tu lista de precios en Excel (.xlsx) o CSV. Necesitamos al menos una columna con el <b>nombre</b> del producto; si tiene <b>precio</b>,{" "}
        <b>stock</b> o <b>código</b>, también los tomamos. Los productos que ya tenés se actualizan (por código o por nombre) y los nuevos se agregan.
        No se borra nada.
      </p>
      <p className="mt-2 text-xs text-white/70">
        Stock: un número, o &quot;hay&quot;, &quot;poco&quot;, &quot;no hay&quot;, &quot;consultar&quot; o &quot;a pedido&quot;. Precio: como lo escribas ($ 1.200,50
        también sirve); vacío queda &quot;A consultar&quot;.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`boton cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${listo ? "" : "pointer-events-none opacity-40"}`}>
          Elegir archivo
          <input
            type="file"
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) elegir(f);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" onClick={descargarEjemplo} className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
          Descargar planilla de ejemplo
        </button>
        {archivo ? <span className="text-xs text-white/70">{archivo}</span> : null}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm">
        {aviso}
        {resultado?.error ? <span className="text-[#ffb4a2]">{resultado.error}</span> : null}
        {resultado && !resultado.error ? (
          <span>
            ¡Listo! Agregamos {resultado.agregados} producto{resultado.agregados === 1 ? "" : "s"} y actualizamos {resultado.actualizados}.
          </span>
        ) : null}
      </p>

      {lectura ? (
        <div className="mt-3 rounded-2xl border border-white/20 p-4">
          <p className="text-sm">
            Encontramos <b>{lectura.filas.length}</b> productos: <b>{nuevos}</b> {nuevos === 1 ? "nuevo" : "nuevos"} y <b>{actualizar}</b> que ya tenías (se {actualizar === 1 ? "actualiza" : "actualizan"}).
            {lectura.columnas.length ? ` Columnas que tomamos: ${lectura.columnas.join(", ")}.` : ""}
          </p>
          {lectura.errores.length ? (
            <details className="mt-2 text-xs" open={lectura.errores.length <= 5}>
              <summary className="cursor-pointer text-[#ffb4a2]">{lectura.errores.length} aviso(s) sobre la planilla</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-white/85">
                {lectura.errores.slice(0, 50).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {pares.length ? (
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-marino">
                  <tr className="text-white/70">
                    <th className="p-2">Producto</th>
                    <th className="p-2">Precio</th>
                    <th className="p-2">Stock</th>
                    <th className="p-2">Qué pasa</th>
                  </tr>
                </thead>
                <tbody>
                  {pares.slice(0, 100).map(({ fila: f, existente }) => (
                    <tr key={f.fila} className="border-t border-white/10">
                      <td className="p-2">
                        {f.nombre}
                        {f.codigo ? <span className="text-white/60"> · {f.codigo}</span> : null}
                      </td>
                      <td className="p-2">{f.precio === undefined ? "—" : plata(f.precio)}</td>
                      <td className="p-2">
                        {textoStock(f)}
                      </td>
                      <td className="p-2">{existente ? "Se actualiza" : "Nuevo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pares.length > 100 ? <p className="p-2 text-xs text-white/70">… y {pares.length - 100} más.</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!pares.length || guardando} onClick={confirmar} className="boton rounded-xl px-4 py-2 text-sm font-semibold">
              {guardando ? "Guardando…" : `Cargar ${pares.length} productos`}
            </button>
            <button type="button" onClick={() => setLectura(null)} className="rounded-xl border border-white/40 px-4 py-2 text-sm hover:bg-white/10">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
