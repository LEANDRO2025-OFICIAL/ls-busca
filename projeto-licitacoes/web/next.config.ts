import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // PGlite (Postgres em WASM, banco de desenvolvimento) carrega arquivos .wasm/.data
  // do próprio pacote: precisa do require nativo do Node, fora do bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // fs.readdir em db.ts lê os arquivos .sql dinamicamente — o tracer estático do Next.js
  // não detecta esse acesso, então inclui explicitamente em todos os traces de servidor.
  outputFileTracingIncludes: {
    "/*": ["./src/db/migracoes/**/*.sql"],
  },
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
