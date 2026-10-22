import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Fotos de productos guardadas en Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yhiampnffbxbwwhhpmzl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Solo para las fotos de los datos de prueba (supabase/03_datos_prueba.sql)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
