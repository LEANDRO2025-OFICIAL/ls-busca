"use client";

import { usePathname } from "next/navigation";
import { Navegacao } from "./navegacao";

/** Barra lateral que sabe em que tela está (o detalhe de licitação pertence à Busca). */
export function NavegacaoApp({ novasParaVoce }: { novasParaVoce?: number }) {
  const caminho = usePathname();
  const atual = caminho.startsWith("/licitacao") ? "/buscar" : caminho.startsWith("/robo") ? "/robo" : caminho;
  return <Navegacao atual={atual} novasParaVoce={novasParaVoce} />;
}
