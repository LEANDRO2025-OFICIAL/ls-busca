"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ETAPAS, ETAPAS_ENCERRADAS, FASES, NOME_ETAPA, type EtapaId } from "@/lib/etapas";
import { useAvisos } from "./avisos";
import { Botao, Selo, type TomSelo } from "./basicos";
import { Prazo } from "./licitacao";

export type { EtapaId };

const ORDEM = ETAPAS;

// Colunas do Kanban = as 6 fases + a saída do fluxo. Soltar um cartão na coluna leva à primeira
// etapa dela; o seletor "Mover para" de cada cartão escolhe a etapa exata.
const COLUNAS: { id: string; nome: string; etapas: readonly EtapaId[] }[] = [
  ...FASES,
  { id: "encerradas", nome: "Encerradas", etapas: ETAPAS_ENCERRADAS },
];

const RESULTADO: Partial<Record<EtapaId, TomSelo>> = {
  ganhou: "sucesso",
  homologacao: "sucesso",
  contrato: "sucesso",
  perdeu: "perigo",
  desistiu: "neutro",
};
const PRIORIDADE: Record<1 | 2 | 3, { nome: string; tom: TomSelo }> = {
  1: { nome: "Alta", tom: "aviso" },
  2: { nome: "Média", tom: "neutro" },
  3: { nome: "Baixa", tom: "neutro" },
};

export type CartaoFunilDados = {
  id: string;
  objeto: string;
  orgaoUf: string;
  etapa: EtapaId;
  prioridade: 1 | 2 | 3;
  tags: string[];
  responsavel?: string;
  prazoISO?: string;
  /** Versão lida do banco, para a trava otimista. */
  versao?: number;
  href?: string;
};

export type ResultadoMovimento = { ok: true; versao: number } | { ok: false; motivo: "conflito" };

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function QuadroFunil({
  cartoesIniciais,
  agoraISO,
  aoMover,
}: {
  cartoesIniciais: CartaoFunilDados[];
  agoraISO: string;
  /** Server Action que grava a etapa. Sem ela, o quadro só demonstra (página /design). */
  aoMover?: (entrada: { id: string; etapa: EtapaId; versao: number }) => Promise<ResultadoMovimento>;
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [anuncio, setAnuncio] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const mostrarAviso = useAvisos();
  const agora = new Date(agoraISO);

  async function mover(id: string, etapa: EtapaId) {
    const cartao = cartoes.find((c) => c.id === id);
    if (!cartao || cartao.etapa === etapa) return;
    const resumo = cartao.objeto.slice(0, 60);
    // Otimista: move já na tela e confirma com o servidor.
    setCartoes((lista) => lista.map((c) => (c.id === id ? { ...c, etapa } : c)));
    setAnuncio(`Movido para ${NOME_ETAPA[etapa]}: ${resumo}`);
    if (!aoMover || cartao.versao == null) return;

    try {
      const resultado = await aoMover({ id, etapa, versao: cartao.versao });
      if (resultado.ok) {
        setCartoes((lista) => lista.map((c) => (c.id === id ? { ...c, versao: resultado.versao } : c)));
        return;
      }
      mostrarAviso("erro", "Outra pessoa mudou este cartão antes. Recarregue a página para ver a etapa atual.");
    } catch {
      mostrarAviso("erro", "Não foi possível salvar a mudança de etapa. Tente de novo.");
    }
    setCartoes((lista) => lista.map((c) => (c.id === id ? { ...c, etapa: cartao.etapa } : c)));
    setAnuncio(`Mudança desfeita: ${resumo} continua em ${NOME_ETAPA[cartao.etapa]}`);
  }

  function teclas(evento: KeyboardEvent<HTMLElement>, cartao: CartaoFunilDados) {
    // Só quando o foco está no próprio cartão (não no select dentro dele).
    if (evento.target !== evento.currentTarget) return;
    const i = ORDEM.indexOf(cartao.etapa);
    if (evento.key === "ArrowRight" && i < ORDEM.length - 1) {
      evento.preventDefault();
      mover(cartao.id, ORDEM[i + 1]);
    } else if (evento.key === "ArrowLeft" && i > 0) {
      evento.preventDefault();
      mover(cartao.id, ORDEM[i - 1]);
    }
  }

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      {/* relative: os textos sr-only (position absolute) dos cartões ficam presos aqui
          em vez de escapar do recorte e alargar a página inteira. */}
      <div className="relative flex gap-3 overflow-x-auto pb-3">
        {COLUNAS.map((coluna) => {
          const daColuna = cartoes.filter((c) => coluna.etapas.includes(c.etapa));
          return (
            <section
              key={coluna.id}
              aria-labelledby={`coluna-${coluna.id}`}
              data-coluna={coluna.id}
              onDragOver={(e) => {
                if (!arrastando) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (sobre !== coluna.id) setSobre(coluna.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = arrastando ?? e.dataTransfer.getData("text/plain");
                const cartao = cartoes.find((c) => c.id === id);
                setArrastando(null);
                setSobre(null);
                // Soltar na própria coluna não muda a etapa (ex.: "Em disputa" continua em Proposta).
                if (cartao && !coluna.etapas.includes(cartao.etapa)) mover(cartao.id, coluna.etapas[0]);
              }}
              className={cn(
                "flex w-coluna shrink-0 flex-col gap-2 rounded-lg bg-surface-2 p-2 transition-shadow",
                sobre === coluna.id && "ring-2 ring-accent",
              )}
            >
              <h3
                id={`coluna-${coluna.id}`}
                className="flex items-center justify-between px-1 pt-1 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {coluna.nome}
                <span className="num rounded-pill bg-bg px-2 py-0.5 text-ink">{daColuna.length}</span>
              </h3>
              {daColuna.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                  Nenhuma licitação nesta etapa.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {daColuna.map((c) => (
                    <li key={c.id}>
                      <article
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", c.id);
                          e.dataTransfer.effectAllowed = "move";
                          setArrastando(c.id);
                        }}
                        onDragEnd={() => {
                          setArrastando(null);
                          setSobre(null);
                        }}
                        onKeyDown={(e) => teclas(e, c)}
                        aria-label={`${c.objeto}. Etapa: ${NOME_ETAPA[c.etapa]}. Setas esquerda e direita mudam a etapa.`}
                        className={cn(
                          "cursor-grab rounded-md border border-line bg-bg p-3 shadow-card active:cursor-grabbing",
                          arrastando === c.id && "opacity-60 shadow-drag",
                          c.prioridade === 1 && "border-l-[3px] border-l-warning",
                        )}
                      >
                        {c.href ? (
                          <Link href={c.href} className="line-clamp-2 text-sm font-medium text-ink hover:text-accent hover:underline">
                            {c.objeto}
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-sm font-medium text-ink">{c.objeto}</p>
                        )}
                        <p className="mt-1 text-xs text-muted">{c.orgaoUf}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {(RESULTADO[c.etapa] || coluna.etapas.length > 1) && (
                            <Selo tom={RESULTADO[c.etapa] ?? "accent"}>{NOME_ETAPA[c.etapa]}</Selo>
                          )}
                          <Selo tom={PRIORIDADE[c.prioridade].tom}>Prioridade {PRIORIDADE[c.prioridade].nome.toLowerCase()}</Selo>
                          {c.tags.map((t) => (
                            <Selo key={t} tom="accent">
                              {t}
                            </Selo>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {c.prazoISO ? <Prazo quando={new Date(c.prazoISO)} agora={agora} /> : <span />}
                          {c.responsavel && (
                            <span
                              title={`Responsável: ${c.responsavel}`}
                              className="flex size-6 items-center justify-center rounded-pill bg-accent-soft text-[10px] font-bold text-accent-strong"
                            >
                              <span aria-hidden>{iniciais(c.responsavel)}</span>
                              <span className="sr-only">Responsável: {c.responsavel}</span>
                            </span>
                          )}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                          Mover para
                          <select
                            value={c.etapa}
                            onChange={(e) => mover(c.id, e.target.value as EtapaId)}
                            className="h-7 min-w-0 flex-1 rounded-sm border border-line-strong bg-bg px-1 text-xs text-ink"
                          >
                            {COLUNAS.map((grupo) => (
                              <optgroup key={grupo.id} label={grupo.nome}>
                                {grupo.etapas.map((etapa) => (
                                  <option key={etapa} value={etapa}>
                                    {NOME_ETAPA[etapa]}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

type ItemChecklist = { id: string; texto: string; feito: boolean };

export function Checklist({ itensIniciais }: { itensIniciais: ItemChecklist[] }) {
  const [itens, setItens] = useState(itensIniciais);
  const [novo, setNovo] = useState("");
  const sequencia = useRef(0);
  const feitos = itens.filter((i) => i.feito).length;

  return (
    <div className="flex max-w-md flex-col gap-2">
      <p className="text-xs text-muted" aria-live="polite">
        {itens.length ? `${feitos} de ${itens.length} concluídos` : "Nenhum item ainda"}
      </p>
      <ul className="flex flex-col gap-0.5">
        {itens.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-surface">
            <input
              id={`item-${item.id}`}
              type="checkbox"
              checked={item.feito}
              onChange={() => setItens((l) => l.map((x) => (x.id === item.id ? { ...x, feito: !x.feito } : x)))}
              className="size-4 accent-accent"
            />
            <label
              htmlFor={`item-${item.id}`}
              className={cn("flex-1 text-sm", item.feito ? "text-muted line-through" : "text-ink")}
            >
              {item.texto}
            </label>
            <button
              type="button"
              onClick={() => setItens((l) => l.filter((x) => x.id !== item.id))}
              aria-label={`Remover ${item.texto}`}
              className="rounded-sm p-1 text-muted hover:text-danger"
            >
              <Trash2 aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const texto = novo.trim();
          if (!texto) return;
          sequencia.current += 1;
          setItens((l) => [...l, { id: `novo-${sequencia.current}`, texto, feito: false }]);
          setNovo("");
        }}
      >
        <label htmlFor="novo-item" className="sr-only">
          Novo item do checklist
        </label>
        <input
          id="novo-item"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={300}
          placeholder="Adicionar item"
          className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink placeholder:text-muted"
        />
        <Botao type="submit" tamanho="sm" variante="secundario" icone={Plus}>
          Adicionar
        </Botao>
      </form>
    </div>
  );
}
