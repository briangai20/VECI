import type { Tabla } from "./supabase/tipos";

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const DIA = 86_400_000;

export const plata = (n: number | null) =>
  n == null ? "A consultar" : "$ " + Math.round(n).toLocaleString("es-AR");

export const km = (n: number) => n.toFixed(1).replace(".", ",") + " km";

export const viaje = (d: number) => ({
  aPie: Math.max(1, Math.round(d * 12)),
  enAuto: Math.max(2, Math.round(d * 3)),
});

export const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// "09:00:00" -> "9:00"
export const hora = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
};

export const horario = (abre: string | null, cierra: string | null) =>
  abre && cierra ? `${hora(abre)} a ${hora(cierra)}` : "Horario sin cargar";

// Si el comercio está abierto ahora, en hora argentina.
export function abiertoAhora(abre: string | null, cierra: string | null, ahora: Date) {
  if (!abre || !cierra) return null;
  const actual = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ahora);
  const hhmm = (t: string) => t.slice(0, 5);
  return actual >= hhmm(abre) && actual < hhmm(cierra);
}

// Franjas de retiro de 2 horas dentro del horario del comercio: las que
// quedan hoy (con al menos una hora de margen) y todas las de mañana.
export function franjasRetiro(abre: string | null, cierra: string | null, ahora: Date) {
  const minutos = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const desde = abre ? minutos(abre) : 9 * 60;
  const hasta = cierra ? minutos(cierra) : 18 * 60;
  const actual = minutos(
    new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ahora),
  );
  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const bloques: [number, number][] = [];
  for (let i = desde; i < hasta; i += 120) bloques.push([i, Math.min(i + 120, hasta)]);
  return [
    ...bloques.filter(([, fin]) => fin - 60 > actual).map(([a, b]) => `Hoy, ${fmt(a)} a ${fmt(b)}`),
    ...bloques.map(([a, b]) => `Mañana, ${fmt(a)} a ${fmt(b)}`),
  ];
}

export type Disponibilidad = {
  texto: string;
  tono: "ok" | "poco" | "no" | "consultar";
  sePuede: boolean;
  requiereConfirmacion: boolean;
};

// Misma lógica que el prototipo: si el comercio no actualiza el stock hace
// días, se muestra "Sin verificar" y la reserva pasa a pedir confirmación.
export function disponibilidad(p: Tabla<"productos">, ahora: Date): Disponibilidad {
  const dias = (ahora.getTime() - new Date(p.actualizado_en).getTime()) / DIA;
  const sinVerificar: Disponibilidad = { texto: "Sin verificar", tono: "consultar", sePuede: true, requiereConfirmacion: true };

  switch (p.modo) {
    case "consultar":
      return { texto: "Consultar disponibilidad", tono: "consultar", sePuede: true, requiereConfirmacion: true };
    case "pedido":
      return { texto: "Sobre pedido", tono: "consultar", sePuede: true, requiereConfirmacion: true };
    case "semaforo":
      if (dias > 3) return sinVerificar;
      if (p.semaforo === "no") return { texto: "No hay", tono: "no", sePuede: false, requiereConfirmacion: false };
      if (p.semaforo === "poco") return { texto: "Poco stock", tono: "poco", sePuede: true, requiereConfirmacion: false };
      return { texto: "Hay stock", tono: "ok", sePuede: true, requiereConfirmacion: false };
    default: {
      if (dias > 7) return sinVerificar;
      const stock = p.stock ?? 0;
      if (stock <= 0) return { texto: "Agotado", tono: "no", sePuede: false, requiereConfirmacion: false };
      if (stock <= 3) return { texto: `Últimas ${stock}`, tono: "poco", sePuede: true, requiereConfirmacion: false };
      return { texto: "Disponible", tono: "ok", sePuede: true, requiereConfirmacion: false };
    }
  }
}

export const promedio = (estrellas: number[]) =>
  estrellas.length ? estrellas.reduce((a, b) => a + b, 0) / estrellas.length : null;

export const nota = (v: number | null) => (v == null ? null : v.toFixed(1).replace(".", ","));
