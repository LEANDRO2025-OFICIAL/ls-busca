import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Impede o site de ser embutido em iframe de terceiros (clickjacking) e reduz vazamento de origem.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // PGlite (Postgres em WASM, banco de desenvolvimento) carrega arquivos .wasm/.data
  // do próprio pacote: precisa do require nativo do Node, fora do bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
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
