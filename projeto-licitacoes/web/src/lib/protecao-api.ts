// Proteção das rotas de dados (lógica pura, testável): decisão de status de autorização e um
// limitador de requisições por janela fixa, EM MEMÓRIA. O limite é POR INSTÂNCIA do servidor:
// não é compartilhado entre processos nem sobrevive a reinício. Serve de freio simples contra
// abuso; defesa real é sessão + licença (verificadas no servidor a cada pedido).

/** Status HTTP para uma rota de dados: 401 sem sessão, 403 sem licença válida, null quando pode seguir. */
export function statusDeAutorizacao(temSessao: boolean, licencaLiberada: boolean): 401 | 403 | null {
  if (!temSessao) return 401;
  if (!licencaLiberada) return 403;
  return null;
}

type Balde = { contagem: number; reinicioEm: number };
const baldes = new Map<string, Balde>();

/**
 * Deixa passar até `limite` chamadas por `janelaMs` para a mesma `chave`. Devolve se passou e
 * quantas restam. Limpa baldes vencidos de leve a cada chamada para não crescer sem limite.
 */
export function permitir(
  chave: string,
  limite: number,
  janelaMs: number,
  agora: number = Date.now(),
): { ok: boolean; restantes: number; reiniciaEm: number } {
  const atual = baldes.get(chave);
  if (!atual || agora >= atual.reinicioEm) {
    const reinicioEm = agora + janelaMs;
    baldes.set(chave, { contagem: 1, reinicioEm });
    if (baldes.size > 5000) for (const [k, b] of baldes) if (agora >= b.reinicioEm) baldes.delete(k);
    return { ok: true, restantes: limite - 1, reiniciaEm: reinicioEm };
  }
  if (atual.contagem >= limite) {
    return { ok: false, restantes: 0, reiniciaEm: atual.reinicioEm };
  }
  atual.contagem += 1;
  return { ok: true, restantes: limite - atual.contagem, reiniciaEm: atual.reinicioEm };
}

/** Só para os testes: esvazia os baldes. */
export function limparBaldes() {
  baldes.clear();
}
