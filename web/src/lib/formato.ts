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

// Horario semanal: franjas por día (0 = domingo … 6 = sábado). Un día sin
// franjas está cerrado. Si cierra <= abre, la franja termina al día siguiente.
export type Franja = { dia: number; abre: string; cierra: string };

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // de lunes a domingo

const aMinutos = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const deMinutos = (m: number) => `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, "0")}`;

// Día de la semana y minuto del día en hora argentina.
export function enArgentina(ahora: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ahora);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday")), minuto: Number(v("hour")) * 60 + Number(v("minute")) };
}

// Las franjas de un día como minutos [inicio, fin), con el fin pasado de 1440 si cruza la medianoche.
function delDia(franjas: Franja[], dia: number) {
  return franjas
    .filter((f) => f.dia === dia)
    .map((f) => {
      const a = aMinutos(f.abre);
      const c = aMinutos(f.cierra);
      return [a, c > a ? c : c + 1440] as [number, number];
    })
    .sort((x, y) => x[0] - y[0]);
}

const textoDia = (franjas: Franja[], dia: number) =>
  delDia(franjas, dia)
    .map(([a, b]) => `${deMinutos(a)} a ${deMinutos(b)}`)
    .join(" y ") || "cerrado";

// "Lun a Vie 9:00 a 13:00 y 16:00 a 20:00 · Sáb 9:00 a 13:00 · Dom cerrado"
export function horario(franjas: Franja[]) {
  if (!franjas.length) return "Horario sin cargar";
  const grupos: { desde: number; hasta: number; texto: string }[] = [];
  for (const d of ORDEN_SEMANA) {
    const t = textoDia(franjas, d);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.texto === t) ultimo.hasta = d;
    else grupos.push({ desde: d, hasta: d, texto: t });
  }
  return grupos
    .map((g) => `${DIAS_CORTOS[g.desde]}${g.desde !== g.hasta ? ` a ${DIAS_CORTOS[g.hasta]}` : ""} ${g.texto}`)
    .join(" · ");
}

// Si el comercio está abierto ahora (null si no cargó horario).
export function abiertoAhora(franjas: Franja[], ahora: Date) {
  if (!franjas.length) return null;
  const { dia, minuto } = enArgentina(ahora);
  const ayer = (dia + 6) % 7;
  return (
    delDia(franjas, dia).some(([a, b]) => minuto >= a && minuto < b) ||
    delDia(franjas, ayer).some(([, b]) => b > 1440 && minuto < b - 1440)
  );
}

// Franjas de retiro de 2 horas dentro del horario: las que quedan hoy (con al
// menos una hora de margen) y las de los dos próximos días que abre.
export function franjasRetiro(franjas: Franja[], ahora: Date) {
  const semana = franjas.length ? franjas : DIAS.map((_, dia) => ({ dia, abre: "09:00", cierra: "18:00" }));
  const { dia: hoy, minuto } = enArgentina(ahora);
  const opciones: string[] = [];
  let diasConHorario = 0;
  for (let i = 0; i < 7 && diasConHorario < 3; i++) {
    const dia = (hoy + i) % 7;
    const nombre = i === 0 ? "Hoy" : i === 1 ? "Mañana" : DIAS[dia];
    const bloques: string[] = [];
    for (const [a, b] of delDia(semana, dia)) {
      for (let m = a; m < b; m += 120) {
        const fin = Math.min(m + 120, b);
        if (i === 0 && fin - 60 <= minuto) continue;
        bloques.push(`${nombre}, ${deMinutos(m)} a ${deMinutos(fin)}`);
      }
    }
    if (bloques.length) diasConHorario++;
    opciones.push(...bloques);
  }
  return opciones;
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
