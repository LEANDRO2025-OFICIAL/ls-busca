import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: só confere se o cookie de sessão existe, para mandar quem
// não entrou direto para /entrar. A validação de verdade (token válido e não
// expirado) acontece em exigirOrganizacao(), em toda leitura e escrita de dados.
export function proxy(request: NextRequest) {
  if (request.cookies.has("sessao")) return NextResponse.next();
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  matcher: ["/visao-geral/:path*", "/para-voce/:path*", "/buscar/:path*", "/funil/:path*", "/licitacao/:path*", "/alertas/:path*", "/comunidade/:path*", "/calendario/:path*", "/configuracoes/:path*", "/inicio/:path*", "/empresa/:path*", "/documentos/:path*", "/ajuda/:path*"],
};
