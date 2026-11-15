import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, Bot, ExternalLink, KeyRound, OctagonX, Play, Trash2 } from "lucide-react";
import { acaoParadaItem, acaoRemoverRobo } from "@/app/acoes-robo";
import { acaoIniciarSessao, acaoRemoverCredencial, acaoSalvarCredencial } from "@/app/acoes-robo-sessao";
import { Alerta, Botao, Esqueleto, Selo } from "@/components/ui/basicos";
import { dataHora, PainelParadaGeral } from "@/components/ui/robo";
import { FormularioRobo, type DadosFormularioRobo } from "@/components/ui/robo-formulario";
import { obterDb } from "@/lib/dados/db";
import { lerParadaGeral, obterConfiguracao } from "@/lib/dados/robo";
import { listarCredenciais, listarSessoes, PORTAIS, ROTULO_PORTAL } from "@/lib/dados/robo-sessao";
import { camposDoItem, segundosDeMs } from "@/lib/robo/formulario";
import { ROTULO_ESTRATEGIA, PARAMETROS_PADRAO } from "@/lib/robo/tipos";
import { escreverCentesimos, formatarValor } from "@/lib/robo/valores";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Configurar robô" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const MENSAGENS: Record<string, string> = {
  salvo: "Configuração salva.",
  parada: "Parada de emergência acionada. Todos os itens foram parados.",
  liberada: "Parada geral liberada. Os itens continuam parados até serem liberados um a um.",
  "item-parado": "Item parado.",
  "item-liberado": "Item liberado.",
  "credencial-salva": "Credencial salva.",
  "credencial-removida": "Credencial removida.",
};
const ERROS: Record<string, string> = {
  "credencial-invalida": "Dados inválidos. Verifique portal, login e senha.",
  "sessao-invalida": "Dados da sessão inválidos.",
  "url-invalida": "URL inválida. Use https://...",
};

const entrada = "h-10 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-ink";

export default function PaginaConfigurarRobo(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <Link href="/robo" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar para o robô de lance
      </Link>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo {...props} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params, searchParams }: Props) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { ok, erro } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const dados = await obterConfiguracao(db, organizacaoId, id);
  if (!dados) notFound();
  const [parada, credenciais, sessoes] = await Promise.all([
    lerParadaGeral(db, organizacaoId),
    listarCredenciais(db, organizacaoId),
    dados.config ? listarSessoes(db, organizacaoId, dados.config.id) : Promise.resolve([]),
  ]);
  const config = dados.config;
  const voltar = `/robo/configurar/${id}`;
  const desconto = config?.criterio === "maior_desconto";

  const p = config?.parametros ?? PARAMETROS_PADRAO;
  const formulario: DadosFormularioRobo = {
    acompanhamentoId: id,
    versao: config?.versao ?? null,
    criterio: config?.criterio ?? "menor_preco",
    modo: config?.modo ?? "aberto",
    parametros: {
      intervaloProprio: segundosDeMs(p.intervaloProprioMs),
      intervaloMelhor: segundosDeMs(p.intervaloMelhorMs),
      diferencaPropria: escreverCentesimos(p.diferencaPropria),
      diferencaMelhor: escreverCentesimos(p.diferencaMelhor),
    },
    itens: config?.itens.map(camposDoItem) ?? [],
  };
  const itemPadrao = {
    numero: "1",
    descricao: dados.objeto.slice(0, 120),
    referencia: dados.valorEstimadoCentavos ? escreverCentesimos(dados.valorEstimadoCentavos) : "",
    limite: "",
    estrategia: "cobrir",
    decrementoTipo: "fixo",
    decremento: "10,00",
    lancesPorMinuto: "6",
    errosSeguidos: "3",
  };
  const mensagem = typeof ok === "string" ? MENSAGENS[ok] : undefined;
  const mensagemErro = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{config ? "Robô de lance" : "Configurar robô de lance"}</h1>
        <p className="line-clamp-3 text-sm text-ink">{dados.objeto}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {dados.orgaoUf}
          <Link href={dados.href} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Ver licitação <ExternalLink aria-hidden className="size-3" />
          </Link>
        </p>
      </header>
      {mensagem && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {mensagem}
        </p>
      )}
      {mensagemErro && <Alerta>{mensagemErro}</Alerta>}
      <PainelParadaGeral parada={parada} voltar={voltar} />

      {config && config.itens.length > 0 && (
        <section aria-labelledby="titulo-itens" className="flex flex-col gap-3">
          <h2 id="titulo-itens" className="text-base font-semibold">
            Itens
          </h2>
          <ul className="flex flex-col gap-2">
            {config.itens.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Item {item.numeroItem} · {item.descricao}
                  </p>
                  <p className="text-xs text-muted">
                    {desconto ? "Desconto máximo" : "Piso"} <span className="num font-semibold text-ink">{formatarValor(item.limite, config.criterio)}</span> ·{" "}
                    {ROTULO_ESTRATEGIA[item.estrategia]}
                  </p>
                </div>
                {item.parada ? <Selo tom="perigo">Parado</Selo> : <Selo tom="sucesso">Liberado</Selo>}
                <form action={acaoParadaItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="voltar" value={voltar} />
                  <input type="hidden" name="parada" value={item.parada ? "0" : "1"} />
                  <Botao type="submit" tamanho="sm" variante={item.parada ? "secundario" : "perigo"} icone={item.parada ? Play : OctagonX}>
                    {item.parada ? "Liberar item" : "Parar item"}
                  </Botao>
                </form>
              </li>
            ))}
          </ul>

        </section>
      )}

      {config && config.itens.length > 0 && (
        <section aria-labelledby="titulo-robo-real" className="flex flex-col gap-4">
          <h2 id="titulo-robo-real" className="flex items-center gap-2 text-base font-semibold">
            <Bot aria-hidden className="size-4 text-accent" />
            Robô real
          </h2>

          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <KeyRound aria-hidden className="size-4 text-muted" />
              <h3 className="text-sm font-semibold text-ink">Credenciais do portal</h3>
            </div>

            {credenciais.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {credenciais.map((cred) => (
                  <li key={cred.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{cred.apelido}</p>
                      <p className="text-xs text-muted">{ROTULO_PORTAL[cred.portal]} · {cred.login}</p>
                    </div>
                    <form action={acaoRemoverCredencial}>
                      <input type="hidden" name="credencialId" value={cred.id} />
                      <input type="hidden" name="voltar" value={voltar} />
                      <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                        Remover
                      </Botao>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhuma credencial salva. Adicione uma abaixo.</p>
            )}

            <form action={acaoSalvarCredencial} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <input type="hidden" name="voltar" value={voltar} />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">Adicionar credencial</p>
              <div className="flex flex-col gap-1">
                <label htmlFor="cred-portal" className="text-xs font-medium text-ink">Portal</label>
                <select id="cred-portal" name="portal" className={entrada}>
                  {PORTAIS.map((p) => (
                    <option key={p} value={p}>{ROTULO_PORTAL[p]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cred-apelido" className="text-xs font-medium text-ink">Apelido</label>
                <input id="cred-apelido" name="apelido" placeholder="Ex: Empresa Alpha" className={entrada} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cred-login" className="text-xs font-medium text-ink">Login / CNPJ</label>
                <input id="cred-login" name="login" placeholder="login@email.com" className={entrada} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cred-senha" className="text-xs font-medium text-ink">Senha</label>
                <input id="cred-senha" name="senha" type="password" autoComplete="new-password" className={entrada} />
              </div>
              <div className="sm:col-span-2">
                <Botao type="submit" variante="secundario" tamanho="sm" icone={KeyRound}>
                  Salvar credencial
                </Botao>
              </div>
            </form>
          </div>

          {credenciais.length > 0 && (
            <form action={acaoIniciarSessao} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
              <input type="hidden" name="roboConfigId" value={config.id} />
              <input type="hidden" name="voltar" value={voltar} />
              <h3 className="text-sm font-semibold text-ink sm:col-span-2">Iniciar sessão do robô</h3>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="sess-item" className="text-xs font-medium text-ink">Item</label>
                <select id="sess-item" name="roboItem" className={entrada}>
                  {config.itens.map((item) => (
                    <option key={item.id} value={`${item.id}|${item.numeroItem}`}>
                      Item {item.numeroItem} · {item.descricao.slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="sess-cred" className="text-xs font-medium text-ink">Credencial</label>
                <select id="sess-cred" name="credencialId" className={entrada}>
                  {credenciais.map((cred) => (
                    <option key={cred.id} value={cred.id}>
                      {ROTULO_PORTAL[cred.portal]} · {cred.apelido}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="sess-portal" className="text-xs font-medium text-ink">Portal</label>
                <select id="sess-portal" name="portal" className={entrada}>
                  {PORTAIS.map((p) => (
                    <option key={p} value={p}>{ROTULO_PORTAL[p]}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="sess-url" className="text-xs font-medium text-ink">URL da sala de disputa</label>
                <input
                  id="sess-url"
                  name="urlDisputa"
                  type="url"
                  placeholder="https://www.comprasnet.gov.br/..."
                  className={entrada}
                  aria-describedby="sess-url-dica"
                />
                <p id="sess-url-dica" className="text-xs text-muted">Cole o link da sala de disputa aberta no portal.</p>
              </div>

              <div className="sm:col-span-2">
                <Botao type="submit" icone={Bot}>
                  Iniciar robô real
                </Botao>
              </div>
            </form>
          )}

          {sessoes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-ink">Sessões recentes</h3>
              <ul className="divide-y divide-line rounded-lg border border-line bg-bg">
                {sessoes.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/robo/sessao/${s.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink">
                        Item {s.numeroItem} · {ROTULO_PORTAL[s.portal]}
                      </span>
                      <Selo
                        tom={
                          s.estado === "em_disputa" || s.estado === "conectando"
                            ? "accent"
                            : s.estado === "encerrado"
                              ? "sucesso"
                              : s.estado === "erro"
                                ? "perigo"
                                : s.estado === "parado"
                                  ? "aviso"
                                  : "neutro"
                        }
                      >
                        {s.estado.replace("_", " ")}
                      </Selo>
                      <span className="text-xs text-muted">{dataHora(s.iniciadaEm)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="titulo-config" className="flex flex-col gap-3">
        <h2 id="titulo-config" className="text-base font-semibold">
          {config ? "Editar configuração" : "Configuração"}
        </h2>
        <FormularioRobo dados={formulario} itemPadrao={itemPadrao} />
      </section>

      {config && (
        <form action={acaoRemoverRobo}>
          <input type="hidden" name="configId" value={config.id} />
          <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
            Remover configuração do robô
          </Botao>
        </form>
      )}
    </>
  );
}
