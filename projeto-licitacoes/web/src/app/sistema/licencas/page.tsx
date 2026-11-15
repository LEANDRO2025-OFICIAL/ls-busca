import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { acaoDefinirLicenca } from "@/app/acoes-licenca";
import { acaoSair } from "@/app/acoes-auth";
import { Alerta, Botao, Esqueleto, Selo, type TomSelo } from "@/components/ui/basicos";
import { obterDb } from "@/lib/dados/db";
import { listarOrganizacoes, type OrganizacaoLicenca } from "@/lib/dados/licenca";
import { tempoRestante } from "@/lib/licenca";
import { exigirDonoSistema } from "@/lib/sessao";

export const metadata: Metadata = { title: "Licenças (sistema)" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const soData = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

const TOM: Record<string, TomSelo> = {
  ativa: "sucesso",
  avaliacao: "accent",
  expirada: "aviso",
  bloqueada: "perigo",
};
const NOME_ESTADO: Record<string, string> = {
  ativa: "Ativa",
  avaliacao: "Em avaliação",
  expirada: "Expirada",
  bloqueada: "Bloqueada",
};

export default function PaginaLicencas({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-conteudo flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Licenças das contas</h1>
          <p className="text-sm text-muted">Tela do nível máximo (dono do sistema). Ativar, renovar, expirar ou bloquear por organização.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inicio" className="text-sm font-semibold text-accent hover:underline">
            Voltar ao app
          </Link>
          <form action={acaoSair}>
            <button type="submit" className="rounded-md border border-line-strong bg-bg px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface">
              Sair
            </button>
          </form>
        </div>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Lista({ searchParams }: { searchParams: Parametros }) {
  await connection();
  await exigirDonoSistema();
  const { ok, erro } = await searchParams;
  const orgs = await listarOrganizacoes(await obterDb());

  return (
    <div className="flex flex-col gap-4">
      {ok && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          Licença atualizada.
        </p>
      )}
      {erro && <Alerta>Não foi possível salvar. Confira os dados.</Alerta>}
      {orgs.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma organização cadastrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orgs.map((o) => (
            <CartaoOrg key={o.id} o={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoOrg({ o }: { o: OrganizacaoLicenca }) {
  const hojeISO = soData.format(new Date());
  const validadeISO = o.licencaExpiraEm ? soData.format(o.licencaExpiraEm) : "";
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{o.nome}</p>
          <p className="text-xs text-muted">
            {o.cnpj ? `CNPJ ${o.cnpj} · ` : ""}
            {o.membros} {o.membros === 1 ? "pessoa" : "pessoas"}
            {o.criadaEm ? ` · criada em ${dataHora.format(o.criadaEm)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selo tom={TOM[o.estado] ?? "neutro"}>{NOME_ESTADO[o.estado] ?? o.estado}</Selo>
          <Selo tom={o.situacao.liberado ? "sucesso" : "perigo"}>{o.situacao.liberado ? "Liberada" : "Bloqueada"}</Selo>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
        <div>
          <dt>Fim da avaliação</dt>
          <dd className="text-ink">{o.trialFim ? dataHora.format(o.trialFim) : "—"}</dd>
        </div>
        <div>
          <dt>Licença válida até</dt>
          <dd className="text-ink">{o.licencaExpiraEm ? dataHora.format(o.licencaExpiraEm) : o.estado === "ativa" ? "Sem data" : "—"}</dd>
        </div>
        <div>
          <dt>Restante</dt>
          <dd className="text-ink">
            {o.situacao.situacao === "avaliacao" && o.situacao.trialRestanteMs != null
              ? tempoRestante(o.situacao.trialRestanteMs)
              : o.situacao.situacao === "ativa" && o.situacao.licencaRestanteMs != null
                ? tempoRestante(o.situacao.licencaRestanteMs)
                : "—"}
          </dd>
        </div>
        <div>
          <dt>Observação</dt>
          <dd className="text-ink">{o.observacao || "—"}</dd>
        </div>
      </dl>

      <form action={acaoDefinirLicenca} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
        <input type="hidden" name="organizacaoId" value={o.id} />
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Estado
          <select name="estado" defaultValue="ativa" className="h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink">
            <option value="ativa">Ativar / renovar</option>
            <option value="expirada">Marcar expirada</option>
            <option value="bloqueada">Bloquear</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink">
          Válida até (só para ativa; vazio = sem data)
          <input type="date" name="expiraEm" min={hojeISO} defaultValue={validadeISO} className="h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink" />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-ink">
          Observação (contrato, NF…)
          <input type="text" name="observacao" maxLength={300} defaultValue={o.observacao ?? ""} className="h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink" />
        </label>
        <Botao type="submit" tamanho="sm">
          Salvar
        </Botao>
      </form>
    </li>
  );
}
