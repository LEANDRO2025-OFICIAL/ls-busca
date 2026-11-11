import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { acaoSalvarEmpresa } from "@/app/acoes-config";
import { Alerta, Botao, CampoTexto, Esqueleto } from "@/components/ui/basicos";
import { Secao } from "@/components/ui/painel";
import { obterConta } from "@/lib/dados/conta";
import { obterDb } from "@/lib/dados/db";
import { PORTES, temTratamentoDiferenciado } from "@/lib/empresa";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Perfil da empresa" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const ERROS: Record<string, string> = {
  permissao: "Só o dono da conta da empresa pode fazer isso.",
  empresa: "Confira o nome (2 a 200 letras), o CNPJ (14 números, ou deixe vazio) e o porte.",
};

export default function PaginaEmpresa({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Perfil da empresa</h1>
        <p className="text-sm text-muted">Quem é a sua empresa para as licitações: nome, CNPJ e porte.</p>
      </header>
      <Suspense fallback={<Esqueleto className="h-72 w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { ok, erro } = await searchParams;
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const conta = await obterConta(await obterDb(), organizacaoId, usuarioId);
  const falha = typeof erro === "string" ? ERROS[erro] : undefined;
  const campo = "h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink disabled:opacity-60";

  return (
    <>
      {ok === "empresa" && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          Dados da empresa salvos.
        </p>
      )}
      {falha && <Alerta>{falha}</Alerta>}

      <Secao titulo="Dados da empresa">
        {!conta.ehDono && <p className="text-xs text-muted">Só o dono da conta pode mudar estes dados.</p>}
        <form action={acaoSalvarEmpresa} className="grid gap-3 sm:grid-cols-2">
          <CampoTexto
            id="empresa-nome"
            name="nome"
            rotulo="Nome da empresa"
            defaultValue={conta.empresa.nome}
            required
            minLength={2}
            maxLength={200}
            disabled={!conta.ehDono}
          />
          <CampoTexto
            id="empresa-cnpj"
            name="cnpj"
            rotulo="CNPJ"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            defaultValue={conta.empresa.cnpj ?? ""}
            maxLength={18}
            disabled={!conta.ehDono}
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink sm:col-span-2">
            Porte da empresa
            <select name="porte" defaultValue={conta.empresa.porte ?? ""} disabled={!conta.ehDono} className={`${campo} max-w-md`}>
              <option value="">Não informado</option>
              {PORTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          {conta.ehDono && (
            <div className="sm:col-span-2">
              <Botao type="submit">Salvar empresa</Botao>
            </div>
          )}
        </form>
      </Secao>

      {temTratamentoDiferenciado(conta.empresa.porte) ? (
        <Secao titulo="Vantagens de ME, EPP e MEI nas licitações">
          <p className="text-sm text-ink">
            Pelo seu porte, a Lei Complementar 123/2006 costuma dar à empresa um tratamento diferenciado. Confira sempre o que o edital
            prevê:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            <li>Preferência em caso de empate: propostas até 5% acima da melhor (10% em algumas modalidades) contam como empate.</li>
            <li>Prazo para regularizar certidões fiscais depois de vencer a disputa.</li>
            <li>Itens de até R$ 80 mil reservados só para ME e EPP.</li>
            <li>Cotas de até 25% em compras de bens que podem ser divididos.</li>
          </ul>
          <Link href="/ajuda#me-epp" className="w-fit text-sm font-semibold text-accent hover:underline">
            Saiba mais na Ajuda
          </Link>
        </Secao>
      ) : (
        <p className="text-xs text-muted">
          Informe o porte para ver aqui as regras que valem para a sua empresa. ME, EPP e MEI têm um tratamento diferenciado nas licitações.
        </p>
      )}

      <Secao titulo="Mais sobre a empresa">
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <Link href="/inicio/ramo" className="font-semibold text-accent hover:underline">
              Ramo da empresa
            </Link>
            <span className="text-muted"> — o que vocês vendem e onde atendem; alimenta as sugestões.</span>
          </li>
          <li>
            <Link href="/documentos" className="font-semibold text-accent hover:underline">
              Documentos
            </Link>
            <span className="text-muted"> — certidões e outros papéis, com aviso de vencimento.</span>
          </li>
          <li>
            <Link href="/configuracoes" className="font-semibold text-accent hover:underline">
              Conta e equipe
            </Link>
            <span className="text-muted"> — seu nome, sua senha e as pessoas da empresa.</span>
          </li>
        </ul>
      </Secao>
    </>
  );
}
