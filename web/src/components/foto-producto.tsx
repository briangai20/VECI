import Image from "next/image";

// Foto del producto, o la inicial si el comercio todavía no subió una.
export function FotoProducto({ url, nombre, sizes, texto = "text-5xl" }: { url: string | null; nombre: string; sizes: string; texto?: string }) {
  if (!url) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-marino-claro font-black text-white ${texto}`}>
        {nombre.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <Image src={url} alt={nombre} fill sizes={sizes} className="object-cover" />;
}
