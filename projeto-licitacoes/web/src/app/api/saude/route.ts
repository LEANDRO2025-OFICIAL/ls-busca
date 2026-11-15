// Identifica este programa para o "Abrir LS Busca.bat" (scripts/verificar-servidor.mjs):
// antes de subir, ele confere se quem responde na porta 3000 já é o LS Busca.
// Não abre o banco.
export function GET() {
  return Response.json({ app: "ls-busca" });
}
