import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { MenuCuenta } from "@/components/menu-cuenta";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VECI | Conectá con el comercio de tu barrio",
    template: "%s | VECI",
  },
  description:
    "Encontrá productos en los comercios de tu barrio, reservalos y retiralos en el local.",
};

export const viewport: Viewport = {
  themeColor: "#14213D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-marino shadow-lg shadow-black/30">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
            <Link href="/" className="mr-auto flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/30 text-lg font-black text-white">
                V
              </span>
              <span>
                <span className="block text-2xl leading-none font-black tracking-tight text-white">VECI</span>
                <span className="mt-1 block text-xs text-white">Conectá con el comercio de tu barrio</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 rounded-2xl border border-white/20 p-1" aria-label="Secciones">
              <Link href="/" className="rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                Buscar
              </Link>
              <Suspense fallback={null}>
                <MenuCuenta />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">{children}</main>
      </body>
    </html>
  );
}
