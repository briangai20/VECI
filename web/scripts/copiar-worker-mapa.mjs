// MapLibre 6 carga su "worker" como un archivo aparte, que el empaquetador de
// Next no copia. Lo dejamos en public/ (se sirve en /maplibre/...) antes de
// cada dev y build, así siempre coincide con la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
console.log("Worker del mapa copiado a public/maplibre/");
