import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Destino del link del mail de confirmación: canjea el código por la sesión.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const pedido = url.searchParams.get("siguiente") ?? "/";
  const siguiente = pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : "/";

  if (codigo) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL(siguiente, url.origin));
  }
  return NextResponse.redirect(new URL("/ingresar?error=link", url.origin));
}
