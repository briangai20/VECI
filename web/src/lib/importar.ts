// Interpreta las filas de una planilla de productos (Excel o CSV). Se usa en
// el navegador para la vista previa y en el servidor para validar de nuevo.

import type { Enum } from "./supabase/tipos";

export type Celda = string | number | boolean | Date | null | undefined;

export type FilaProducto = {
  fila: number; // número de fila en la planilla, para los mensajes
  codigo: string | null;
  nombre: string;
  marca: string | null;
  grupo: string | null;
  descripcion: string | null;
  // undefined = la planilla no trae ese dato (al actualizar, se deja como estaba)
  precio?: number | null;
  modo?: Enum<"modo_stock">;
  stock?: number | null;
  semaforo?: Enum<"semaforo"> | null;
};

export type ResultadoLectura = { filas: FilaProducto[]; errores: string[]; columnas: string[] };

export const MAX_FILAS = 2000;

const normal = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Nombres de columna que se aceptan para cada dato.
const COLUMNAS: Record<"codigo" | "nombre" | "marca" | "grupo" | "descripcion" | "precio" | "stock", string[]> = {
  codigo: ["codigo", "cod", "sku", "codigo interno", "id", "articulo", "codigo de articulo", "ean", "codigo de barras"],
  nombre: ["nombre", "producto", "nombre del producto", "detalle", "item", "articulo nombre"],
  marca: ["marca", "fabricante"],
  grupo: ["grupo", "variantes", "grupo de variantes", "familia"],
  descripcion: ["descripcion", "observaciones", "comentario", "caracteristicas"],
  precio: ["precio", "precio venta", "precio de venta", "precio final", "pvp", "importe", "valor", "precio unitario"],
  stock: ["stock", "cantidad", "existencia", "disponible", "unidades", "cant", "disponibilidad"],
};

function columnaDe(encabezado: string): keyof typeof COLUMNAS | null {
  const n = normal(encabezado);
  if (!n) return null;
  for (const [clave, nombres] of Object.entries(COLUMNAS) as [keyof typeof COLUMNAS, string[]][]) {
    if (nombres.includes(n)) return clave;
  }
  // "Precio ($)", "Stock actual", "Descripción del artículo"...
  for (const [clave, nombres] of Object.entries(COLUMNAS) as [keyof typeof COLUMNAS, string[]][]) {
    if (nombres.some((x) => x.length > 3 && n.startsWith(x))) return clave;
  }
  return null;
}

const texto = (v: Celda) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// "$ 1.200,50" -> 1200.5 · "1200.5" -> 1200.5 · "1.200" -> 1200 · "" / "consultar" -> null
export function leerPrecio(v: Celda): number | null | "error" {
  if (typeof v === "number") return v >= 0 ? Math.round(v * 100) / 100 : "error";
  let s = texto(v).replace(/^\$\s*/, "").replace(/\s/g, "");
  if (!s || /consult|^-$/i.test(s)) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "error";
}

// Número -> stock exacto · "hay"/"poco"/"no hay" -> semáforo · "consultar" · "a pedido"
export function leerStock(v: Celda): Pick<FilaProducto, "modo" | "stock" | "semaforo"> | "error" | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? { modo: "exacto", stock: Math.floor(v), semaforo: null } : "error";
  const s = normal(texto(v));
  if (!s) return null;
  if (/^\d+$/.test(s)) return { modo: "exacto", stock: Number(s), semaforo: null };
  if (["no", "no hay", "sin stock", "agotado", "0 no"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "no" };
  if (["poco", "pocas", "pocos", "ultimas", "ultimos", "bajo"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "poco" };
  if (["hay", "si", "disponible", "con stock", "ok"].includes(s)) return { modo: "semaforo", stock: null, semaforo: "hay" };
  if (s.startsWith("consult")) return { modo: "consultar", stock: null, semaforo: null };
  if (s.includes("pedido") || s.includes("encargo")) return { modo: "pedido", stock: null, semaforo: null };
  return "error";
}

// Recibe la planilla como filas de celdas (la primera, con los títulos).
export function interpretarPlanilla(matriz: Celda[][]): ResultadoLectura {
  const errores: string[] = [];
  const conDatos = matriz.filter((f) => f.some((c) => texto(c) !== ""));
  if (!conDatos.length) return { filas: [], errores: ["La planilla está vacía."], columnas: [] };

  // Busca la fila de títulos entre las primeras 5 (a veces arriba hay un logo o un título).
  let idxTitulos = -1;
  let mapa: (keyof typeof COLUMNAS | null)[] = [];
  for (let i = 0; i < Math.min(5, matriz.length); i++) {
    const m = matriz[i].map((c) => columnaDe(texto(c)));
    if (m.includes("nombre")) {
      idxTitulos = i;
      mapa = m;
      break;
    }
  }
  // Sin títulos reconocibles: se asume nombre, precio, stock (como en el prototipo).
  if (idxTitulos === -1) mapa = ["nombre", "precio", "stock"];

  const columnas = [...new Set(mapa.filter((c): c is keyof typeof COLUMNAS => c != null))];
  const filas: FilaProducto[] = [];
  const vistos = new Map<string, number>();

  for (let i = idxTitulos + 1; i < matriz.length; i++) {
    const f = matriz[i];
    if (!f.some((c) => texto(c) !== "")) continue;
    if (filas.length >= MAX_FILAS) {
      errores.push(`La planilla tiene más de ${MAX_FILAS} productos: cargamos los primeros ${MAX_FILAS}. Dividila en dos archivos.`);
      break;
    }
    const n = i + 1;
    const dato = (k: keyof typeof COLUMNAS): Celda | undefined => {
      const j = mapa.indexOf(k);
      return j === -1 ? undefined : f[j];
    };
    const nombre = texto(dato("nombre")).slice(0, 200);
    if (!nombre) {
      errores.push(`Fila ${n}: falta el nombre del producto (la salteamos).`);
      continue;
    }
    const fila: FilaProducto = {
      fila: n,
      codigo: texto(dato("codigo")).slice(0, 60) || null,
      nombre,
      marca: texto(dato("marca")).slice(0, 80) || null,
      grupo: texto(dato("grupo")).slice(0, 120) || null,
      descripcion: texto(dato("descripcion")).slice(0, 1000) || null,
    };
    if (columnas.includes("precio")) {
      const p = leerPrecio(dato("precio"));
      if (p === "error") {
        errores.push(`Fila ${n} (${nombre}): el precio "${texto(dato("precio"))}" no es un número (lo dejamos "A consultar").`);
        fila.precio = null;
      } else fila.precio = p;
    }
    if (columnas.includes("stock")) {
      const s = leerStock(dato("stock"));
      if (s === "error") {
        errores.push(`Fila ${n} (${nombre}): no entendimos el stock "${texto(dato("stock"))}" (lo dejamos como "Consultar").`);
        Object.assign(fila, { modo: "consultar", stock: null, semaforo: null });
      } else if (s) Object.assign(fila, s);
    }
    const clave = fila.codigo ? `c:${fila.codigo}` : `n:${normal(nombre)}`;
    if (vistos.has(clave)) {
      errores.push(`Fila ${n} (${nombre}): está repetida con la fila ${vistos.get(clave)} (usamos la última).`);
      filas.splice(
        filas.findIndex((x) => x.fila === vistos.get(clave)),
        1,
      );
    }
    vistos.set(clave, n);
    filas.push(fila);
  }
  if (!filas.length && !errores.length) errores.push("No encontramos productos en la planilla.");
  return { filas, errores, columnas };
}

// Une cada fila con un producto existente: primero por código, después por nombre.
export function emparejar<F extends { codigo: string | null; nombre: string }, T extends { id: number; codigo: string | null; nombre: string }>(
  filas: F[],
  existentes: T[],
) {
  const porCodigo = new Map(existentes.filter((p) => p.codigo).map((p) => [p.codigo!, p]));
  const porNombre = new Map(existentes.map((p) => [normal(p.nombre), p]));
  return filas.map((f) => ({ fila: f, existente: (f.codigo && porCodigo.get(f.codigo)) || porNombre.get(normal(f.nombre)) || null }));
}

export const nombreNormal = normal;
