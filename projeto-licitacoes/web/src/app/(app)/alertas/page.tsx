import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BellOff, Check, Trash2 } from "lucide-react";
import { acaoMarcarBuscaVista, acaoRemoverBusca } from "@/app/acoes";
import { Botao, Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { formatarValor } from "@/components/ui/licitacao";
import { listarBuscasSalvas, novidadesDoAlerta } from "@/lib/dados/alertas";
import { obterDb } from "@/lib/dados/db";
import { listarModalidades, obterPerfil } from "@/lib/dados/perfil";
import { montarHref } from "@/lib/filtros-busca";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Alertas" };

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function PaginaAlertas() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Alertas</h1>
        <p className="text-sm text-muted">
          Suas buscas salvas. Cada uma mostra as licitações que entraram na base desde a última vez que você marcou como vistas.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-64 w-full" />}>
        <Lista />
      </Suspense>
      <p className="text-xs text-muted">
        A base é atualizada pelo PNCP enquanto o sistema está aberto. Configure GMAIL_USER e GMAIL_APP_PASSWORD para receber avisos por e-mail.
      </p>
    </main>
  );
}

async function Lista() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const buscas = await listarBuscasSalvas(db, organizacaoId);
  if (buscas.length === 0) {
    return (
      <EstadoVazio
        icone={BellOff}
        titulo="Nenhum alerta ainda"
        texto="Faça uma busca, aplique os filtros que quiser e clique em “Salvar alerta” logo abaixo do total de resultados."
        acao={
          <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
            Ir para a busca
          </Link>
        }
      />
    );
  }

  const perfil = await obterPerfil(db, organizacaoId);
  const nomesModalidade = new Map((await listarModalidades(db)).map((m) => [m.id, m.nome]));

  const cartoes = [];
  for (const b of buscas) {
    const { f, novas } = await novidadesDoAlerta(db, organizacaoId, perfil, b);
    const resumo = [
      f.q && `“${f.q}”`,
      f.ramo && "Meu ramo",
      f.uf,
      f.modalidade && (nomesModalidade.get(f.modalidade) ?? `Modalidade ${f.modalidade}`),
      f.valorMin != null && `a partir de ${formatarValor(f.valorMin * 100)}`,
      f.valorMax != null && `até ${formatarValor(f.valorMax * 100)}`,
      f.encerra && "encerra em 7 dias",
      f.aderencia && (f.aderencia === 70 ? "aderência alta" : "aderência média ou alta"),
    ].filter(Boolean);
    cartoes.push({ b, f, novas, resumo });
  }

  return (
    <ul className="flex flex-col gap-3">
      {cartoes.map(({ b, f, novas, resumo }) => (
        <li key={b.id} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">{b.nome}</h2>
              <p className="text-xs text-muted">{resumo.join(" · ")}</p>
            </div>
            <Selo tom={novas.total > 0 ? "accent" : "neutro"}>
              {novas.total === 0 ? "Nada novo" : `${novas.total} ${novas.total === 1 ? "nova" : "novas"}`}
            </Selo>
          </div>

          {novas.linhas.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {novas.linhas.slice(0, 3).map((l) => (
                <li key={l.numeroControle} className="px-3 py-2">
                  <Link
                    href={`/licitacao/${l.cnpj}/${l.ano}/${l.sequencial}`}
                    className="line-clamp-1 text-sm text-ink hover:text-accent hover:underline"
                  >
                    {l.objeto}
                  </Link>
                  <p className="text-xs text-muted">
                    {l.orgao} · {l.uf} · {formatarValor(l.valorCentavos)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {novas.total > 0 && (
              <Link
                href={montarHref(f.atuais, { desde: b.vistoEm.toISOString() })}
                className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-semibold text-on-accent hover:bg-accent-hover"
              >
                Ver as {novas.total} novas
              </Link>
            )}
            <Link
              href={montarHref(f.atuais, { desde: null })}
              className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              Ver todas
            </Link>
            {novas.total > 0 && (
              <form action={acaoMarcarBuscaVista}>
                <input type="hidden" name="id" value={b.id} />
                <Botao type="submit" variante="secundario" tamanho="sm" icone={Check}>
                  Marcar como vistas
                </Botao>
              </form>
            )}
            <form action={acaoRemoverBusca} className="ml-auto">
              <input type="hidden" name="id" value={b.id} />
              <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                Excluir<span className="sr-only"> o alerta {b.nome}</span>
              </Botao>
            </form>
          </div>
          <p className="text-xs text-muted">Visto pela última vez em {formatoDataHora.format(b.vistoEm)}</p>
        </li>
      ))}
    </ul>
  );
}
