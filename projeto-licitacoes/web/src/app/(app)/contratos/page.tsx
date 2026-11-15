import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarX2, ExternalLink, FileStack, Plus, Trash2 } from "lucide-react";
import { acaoAditivarContrato, acaoRemoverContrato, acaoSalvarContrato } from "@/app/acoes-contratos";
import { Alerta, Botao, CampoTexto, Esqueleto, EstadoVazio, Selo, type TomSelo } from "@/components/ui/basicos";
import { Indicador, Secao } from "@/components/ui/painel";
import { obterDb } from "@/lib/dados/db";
import { listarContratos, statusDoContrato, type StatusContrato } from "@/lib/dados/contratos";
import { exigirOrganizacao } from "@/lib/sessao";
import { formatarValor } from "@/components/ui/licitacao";

export const metadata: Metadata = { title: "Contratos e ATAs" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

const SUCESSOS: Record<string, string> = {
  criado: "Cadastrado com sucesso.",
  removido: "Removido.",
  aditivo: "Aditivo registrado. Vigência e valor atualizados.",
};
const ERROS: Record<string, string> = {
  dados: "Verifique os campos obrigatórios e as datas.",
};

const TOM: Record<StatusContrato, TomSelo> = { vencido: "perigo", vencendo: "aviso", vigente: "sucesso" };
const ROTULO_STATUS: Record<StatusContrato, string> = { vencido: "Vencido", vencendo: "Vence em breve", vigente: "Vigente" };
const ROTULO_TIPO: Record<string, string> = { contrato: "Contrato", ata: "ATA de RP" };

function dataBr(aaaammdd: string) {
  const [a, m, d] = aaaammdd.split("-");
  return `${d}/${m}/${a}`;
}

function formatarDias(dias: number) {
  if (dias < 0) return `há ${-dias} dia${-dias === 1 ? "" : "s"}`;
  if (dias === 0) return "vence hoje";
  return `em ${dias} dia${dias === 1 ? "" : "s"}`;
}

const campo = "h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";

export default function PaginaContratos({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Contratos e ATAs</h1>
        <p className="text-sm text-muted">
          Registre contratos e ATAs de registro de preços. O sistema monitora a vigência e avisa antes do vencimento.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { ok, erro } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const contratos = await listarContratos(await obterDb(), organizacaoId);
  const hoje = chaveDia.format(new Date());

  const lista = contratos.map((c) => ({
    c,
    ...statusDoContrato(c.dataFim, hoje),
  }));

  const conta = (s: StatusContrato) => lista.filter((x) => x.status === s).length;
  const sucesso = typeof ok === "string" ? SUCESSOS[ok] : undefined;
  const falha = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      {sucesso && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {sucesso}
        </p>
      )}
      {falha && <Alerta>{falha}</Alerta>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Indicador rotulo="Vencidos" valor={conta("vencido")} />
        <Indicador rotulo="Vencem em 30 dias" valor={conta("vencendo")} />
        <Indicador rotulo="Vigentes" valor={conta("vigente")} />
        <Indicador rotulo="Total" valor={lista.length} />
      </div>

      <Secao titulo="Novo cadastro">
        <form action={acaoSalvarContrato} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Tipo
            <select name="tipo" className={campo}>
              <option value="contrato">Contrato</option>
              <option value="ata">ATA de Registro de Preços</option>
            </select>
          </label>
          <CampoTexto id="ct-numero" name="numero" rotulo="Número / ano" required maxLength={100} dica="Ex: 001/2025" />
          <CampoTexto id="ct-orgao" name="orgaoNome" rotulo="Órgão contratante" required maxLength={300} className="sm:col-span-2" />
          <CampoTexto id="ct-cnpj" name="orgaoCnpj" rotulo="CNPJ do órgão (opcional)" maxLength={18} />
          <CampoTexto id="ct-objeto" name="objeto" rotulo="Objeto" required maxLength={2000} className="sm:col-span-2" />
          <CampoTexto id="ct-valor" name="valorTotal" rotulo="Valor total (R$, opcional)" maxLength={20} dica="Ex: 150000,00" />
          <CampoTexto id="ct-inicio" name="dataInicio" type="date" rotulo="Início da vigência" required />
          <CampoTexto id="ct-fim" name="dataFim" type="date" rotulo="Fim da vigência" required />
          <CampoTexto id="ct-pncp" name="numeroControlePncp" rotulo="Nº controle PNCP (opcional)" maxLength={40} />
          <CampoTexto id="ct-link" name="linkExterno" rotulo="Link externo (opcional)" maxLength={500} />
          <CampoTexto id="ct-notas" name="notas" rotulo="Notas (opcional)" maxLength={2000} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Botao type="submit" icone={Plus}>
              Cadastrar
            </Botao>
          </div>
        </form>
      </Secao>

      {lista.length === 0 ? (
        <EstadoVazio
          icone={FileStack}
          titulo="Nenhum contrato ou ATA cadastrado"
          texto="Cadastre o primeiro contrato ou ATA acima. Você será avisado antes do vencimento."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map(({ c, status, diasRestantes }) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Selo>{ROTULO_TIPO[c.tipo] ?? c.tipo}</Selo>
                    <Selo tom={TOM[status]}>{ROTULO_STATUS[status]} · {formatarDias(diasRestantes)}</Selo>
                    {c.aditivos > 0 && <Selo tom="accent">{c.aditivos} aditivo{c.aditivos > 1 ? "s" : ""}</Selo>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">{c.numero}</p>
                  <p className="text-xs text-muted">{c.orgaoNome}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink">{c.objeto}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    <span>{dataBr(c.dataInicio)} → {dataBr(c.dataFim)}</span>
                    {c.valorAtualCentavos != null && (
                      <span>{formatarValor(c.valorAtualCentavos)}{c.aditivos > 0 && " (atualizado)"}</span>
                    )}
                  </div>
                  {c.notas && <p className="mt-1 text-xs text-muted">{c.notas}</p>}
                </div>
                {c.linkExterno && (
                  <a href={c.linkExterno} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    <ExternalLink className="size-3" />
                    Ver
                  </a>
                )}
              </div>

              {/* Aditivo */}
              <details className="border-t border-line pt-3">
                <summary className="cursor-pointer text-xs font-medium text-accent hover:underline">
                  Registrar aditivo
                </summary>
                <form action={acaoAditivarContrato} className="mt-3 grid gap-2 sm:grid-cols-3">
                  <input type="hidden" name="id" value={c.id} />
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Novo valor (R$)
                    <input name="valorAtual" required placeholder="Ex: 165000,00" className={`${campo} text-xs`} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Nova data fim
                    <input name="dataFim" type="date" required defaultValue={c.dataFim} className={`${campo} text-xs`} />
                  </label>
                  <div className="flex items-end">
                    <Botao type="submit" variante="secundario" tamanho="sm" icone={CalendarX2}>
                      Registrar
                    </Botao>
                  </div>
                </form>
              </details>

              <form action={acaoRemoverContrato} className="border-t border-line pt-2">
                <input type="hidden" name="id" value={c.id} />
                <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                  Remover
                </Botao>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
