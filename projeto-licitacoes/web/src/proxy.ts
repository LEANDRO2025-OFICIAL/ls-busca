import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: só confere se o cookie de sessão existe, para mandar quem
// não entrou direto para /entrar. A validação de verdade (token válido e não
// expirado) acontece em exigirOrganizacao(), em toda leitura e escrita de dados.
// Na raiz: quem tem sessão vai para /inicio; o visitante, para a apresentação pública.
export function proxy(request: NextRequest) {
  const temSessao = request.cookies.has("sessao");
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(temSessao ? "/inicio" : "/apresentacao", request.url));
  }
  if (temSessao) return NextResponse.next();
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  matcher: ["/", "/visao-geral/:path*", "/para-voce/:path*", "/buscar/:path*", "/funil/:path*", "/licitacao/:path*", "/alertas/:path*", "/comunidade/:path*", "/calendario/:path*", "/robo/:path*", "/configuracoes/:path*", "/inicio/:path*", "/empresa/:path*", "/documentos/:path*", "/ajuda/:path*"],
};
