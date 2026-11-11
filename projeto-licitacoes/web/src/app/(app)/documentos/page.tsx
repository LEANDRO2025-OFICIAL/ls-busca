import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import { acaoRemoverDocumento, acaoRenovarDocumento, acaoSalvarDocumento } from "@/app/acoes-documentos";
import { Alerta, Botao, CampoTexto, Esqueleto, EstadoVazio, Selo, type TomSelo } from "@/components/ui/basicos";
import { Indicador, Secao } from "@/components/ui/painel";
import { obterDb } from "@/lib/dados/db";
import { listarDocumentos } from "@/lib/dados/documentos";
import { DIAS_AVISO, nomeDoTipo, statusDoDocumento, TIPOS_DOCUMENTO, type StatusDocumento } from "@/lib/empresa";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Documentos" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

const SUCESSOS: Record<string, string> = {
  criado: "Documento cadastrado.",
  renovado: "Validade atualizada.",
  removido: "Documento removido.",
};
const ERROS: Record<string, string> = {
  documento: "Confira o tipo, o nome (obrigatório em “Outro documento”) e a validade.",
  validade: "Informe a nova validade.",
};
const TOM: Record<StatusDocumento, TomSelo> = { vencido: "perigo", vencendo: "aviso", valido: "sucesso", "sem-validade": "neutro" };

function dataBr(aaaammdd: string) {
  const [a, m, d] = aaaammdd.split("-");
  return `${d}/${m}/${a}`;
}

function rotuloStatus(status: StatusDocumento, dias: number | null, validade: string | null) {
  if (status === "sem-validade" || dias == null || !validade) return "Sem validade";
  if (status === "vencido") return dias === -1 ? "Venceu ontem" : `Vencido há ${-dias} dias`;
  if (status === "vencendo") return dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`;
  return `Válido até ${dataBr(validade)}`;
}

export default function PaginaDocumentos({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Documentos</h1>
        <p className="text-sm text-muted">
          Certidões e papéis que os editais pedem na habilitação. O sistema guarda os dados e a validade, não o arquivo, e avisa antes de vencer.
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
  const documentos = await listarDocumentos(await obterDb(), organizacaoId);
  const hoje = chaveDia.format(new Date());
  const lista = documentos.map((d) => ({ d, ...statusDoDocumento(d.validade, hoje) }));
  const conta = (s: StatusDocumento) => lista.filter((x) => x.status === s).length;
  const sucesso = typeof ok === "string" ? SUCESSOS[ok] : undefined;
  const falha = typeof erro === "string" ? ERROS[erro] : undefined;
  const campo = "h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";

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
        <Indicador rotulo={`Vencem em ${DIAS_AVISO} dias`} valor={conta("vencendo")} />
        <Indicador rotulo="Em dia" valor={conta("valido") + conta("sem-validade")} />
        <Indicador rotulo="Total" valor={lista.length} />
      </div>

      <Secao titulo="Cadastrar documento">
        <form action={acaoSalvarDocumento} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Tipo
            <select name="tipo" required className={campo}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <CampoTexto id="doc-nome" name="nome" rotulo="Nome (opcional)" maxLength={200} dica="Sem nome, vale o nome do tipo." />
          <CampoTexto id="doc-numero" name="numero" rotulo="Número ou código (opcional)" maxLength={100} />
          <CampoTexto id="doc-validade" name="validade" type="date" rotulo="Validade (opcional)" />
          <CampoTexto
            id="doc-obs"
            name="observacao"
            rotulo="Onde está o arquivo (opcional)"
            maxLength={500}
            dica="Pasta, link ou qualquer lembrete."
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <Botao type="submit" icone={Plus}>
              Cadastrar
            </Botao>
          </div>
        </form>
      </Secao>

      {lista.length === 0 ? (
        <EstadoVazio
          icone={FileText}
          titulo="Nenhum documento cadastrado"
          texto="Comece pelas certidões que quase todo edital pede: federal, FGTS, trabalhista, estadual e municipal."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map(({ d, status, dias }) => (
            <li key={d.id} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">{d.nome}</h2>
                  <p className="text-xs text-muted">
                    {nomeDoTipo(d.tipo)}
                    {d.numero && ` · nº ${d.numero}`}
                  </p>
                  {d.observacao && <p className="mt-1 text-xs text-muted">{d.observacao}</p>}
                </div>
                <Selo tom={TOM[status]}>{rotuloStatus(status, dias, d.validade)}</Selo>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                <form action={acaoRenovarDocumento} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Nova validade
                    <input name="validade" type="date" required className={campo} />
                  </label>
                  <Botao type="submit" variante="secundario" tamanho="sm" icone={RefreshCw}>
                    Renovar<span className="sr-only"> {d.nome}</span>
                  </Botao>
                </form>
                <form action={acaoRemoverDocumento}>
                  <input type="hidden" name="id" value={d.id} />
                  <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                    Remover<span className="sr-only"> {d.nome}</span>
                  </Botao>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
