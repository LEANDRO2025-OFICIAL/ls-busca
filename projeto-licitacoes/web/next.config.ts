import type { NextConfig } from "next";

const producao = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dissuasão (NÃO barreira: o código do navegador é sempre visível — ver docs/PROTECAO-E-LICENCA.md).
  // Sem source maps no navegador em produção e sem console.* (menos pistas no bundle entregue).
  // O minificador do Next já remove comentários do JS de produção.
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: producao ? { exclude: ["error", "warn"] } : false,
  },
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
  serverExternalPackages: ["@electric-sql/pglite", "playwright"],
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
