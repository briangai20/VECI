import Link from "next/link";
import { salir } from "@/app/ingresar/acciones";
import { usuarioActual } from "@/lib/sesion";

const enlace = "rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10";

export async function MenuCuenta() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return (
      <>
        <Link href="/comerciante" className={enlace}>
          Soy comerciante
        </Link>
        <Link href="/ingresar" className={`${enlace} bg-white/10`}>
          Ingresar
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/reservas" className={enlace}>
        Mis reservas
      </Link>
      {usuario.rol === "comerciante" ? (
        <Link href="/comerciante" className={enlace}>
          Mi comercio
        </Link>
      ) : null}
      <form action={salir}>
        <button className={enlace} title={usuario.email}>
          Salir
        </button>
      </form>
    </>
  );
}
