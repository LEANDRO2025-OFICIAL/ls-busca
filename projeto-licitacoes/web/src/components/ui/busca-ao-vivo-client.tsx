"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Esqueleto, EstadoVazio } from "@/components/ui/basicos";
import { CabecalhoLista, LinhaLicitacao } from "@/components/ui/licitacao";
import {
  buscarAoVivoNoNavegador,
  POR_PAGINA_NAVEGADOR,
  type LinhaAoVivo,
} from "@/lib/dados/busca-navegador";
import { montarHref } from "@/lib/filtros-busca";

export function BuscaAoVivoClient({
  q,
  uf,
  modalidade,
  pagina,
  atuais,
  acaoAcompanhar,
}: {
  q: string;
  uf: string | null;
  modalidade: number | null;
  pagina: number;
  atuais: Record<string, string>;
  acaoAcompanhar?: (formData: FormData) => Promise<void>;
}) {
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [linhas, setLinhas] = useState<LinhaAoVivo[]>([]);
  const [total, setTotal] = useState(0);
  const [parcial, setParcial] = useState(false);
  const agora = useRef(new Date()).current;

  useEffect(() => {
    setEstado("carregando");
    buscarAoVivoNoNavegador({ q, uf, modalidade, pagina })
      .then((r) => {
        if (r.erro) {
          setEstado("erro");
          return;
        }
        setLinhas(r.linhas);
        setTotal(r.total);
        setParcial(r.parcial);
        setEstado("ok");
      })
      .catch(() => setEstado("erro"));
  }, [q, uf, modalidade, pagina]);

  if (estado === "carregando") {
    return (
      <div aria-busy="true" aria-label="Buscando no PNCP" className="flex flex-col gap-3">
        <Esqueleto className="h-4 w-48" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line py-3">
            <div className="flex flex-1 flex-col gap-2">
              <Esqueleto className="h-4 w-4/5" />
              <Esqueleto className="h-3 w-2/5" />
            </div>
            <Esqueleto className="h-4 w-24 max-md:hidden" />
            <Esqueleto className="h-4 w-28 max-md:hidden" />
          </div>
        ))}
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <EstadoVazio
        icone={SearchX}
        titulo="Não foi possível consultar o PNCP"
        texto="Verifique sua conexão e tente recarregar a página."
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_NAVEGADOR));

  return (
    <>
      <p className="text-sm text-muted" aria-live="polite">
        {total} {total === 1 ? "resultado" : "resultados"} ao vivo do PNCP
        {parcial && " (resultados parciais)"}
      </p>

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={SearchX}
          titulo="Nenhum resultado no PNCP para esse termo"
          texto="Tente um termo mais geral ou verifique a grafia. Os resultados vêm das 4 principais modalidades do PNCP."
          acao={
            <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
              Limpar a busca
            </Link>
          }
        />
      ) : (
        <div>
          <CabecalhoLista />
          <div className="flex flex-col gap-3 md:gap-0">
            {linhas.map((l) => (
              <LinhaLicitacao
                key={l.id}
                agora={agora}
                acaoAcompanhar={acaoAcompanhar}
                l={{
                  id: l.id,
                  href: `/licitacao/${l.cnpj}/${l.ano}/${l.sequencial}`,
                  objeto: l.objeto,
                  orgao: l.orgao,
                  municipio: l.municipio ?? "—",
                  uf: l.uf,
                  modalidade: l.modalidade,
                  valorCentavos: l.valorCentavos,
                  encerramento: l.encerramento,
                  aderencia: null,
                  motivos: undefined,
                  etapaNoFunil: undefined,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {totalPaginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
          {pagina > 1 ? (
            <Link
              href={montarHref(atuais, { pagina: String(pagina - 1) })}
              className="font-semibold text-accent hover:underline"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={montarHref(atuais, { pagina: String(pagina + 1) })}
              className="font-semibold text-accent hover:underline"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
