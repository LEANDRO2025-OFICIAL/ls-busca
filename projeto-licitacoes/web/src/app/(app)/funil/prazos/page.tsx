import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Plus, Trash2 } from "lucide-react";
import { acaoAdicionarPrazo, acaoRemoverPrazo } from "@/app/acoes";
import { Alerta, Botao, CampoTexto, Esqueleto } from "@/components/ui/basicos";
import { ListaPrazos } from "@/components/ui/licitacao";
import { obterDb } from "@/lib/dados/db";
import { listarCartoes } from "@/lib/dados/funil";
import { listarPrazos } from "@/lib/dados/prazos";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Prazos" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const FINAIS = new Set(["perdeu", "desistiu"]);

export default function PaginaPrazos({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Prazos</h1>
        <p className="text-sm text-muted">
          Datas das licitações que você acompanha: fim do envio de propostas (PNCP) e prazos que a equipe criar.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-80 w-full" />}>
        <Agenda searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Agenda({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { erro, ok } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const prazos = await listarPrazos(db, organizacaoId);
  const cartoes = (await listarCartoes(db, organizacaoId)).filter((c) => !FINAIS.has(c.etapa));
  const agora = new Date();
  const atrasados = prazos.filter((p) => p.quando < agora);
  const futuros = prazos.filter((p) => p.quando >= agora);

  const paraEvento = (p: (typeof prazos)[number]) => ({
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    quando: p.quando,
    href: p.href,
    detalhe: p.objeto,
    acao: p.prazoId ? (
      <form action={acaoRemoverPrazo}>
        <input type="hidden" name="prazoId" value={p.prazoId} />
        <button type="submit" className="rounded-sm p-1 text-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 aria-hidden className="size-4" />
          <span className="sr-only">Apagar prazo “{p.titulo}”</span>
        </button>
      </form>
    ) : undefined,
  });

  return (
    <>
      {erro === "dados" && <Alerta>Confira a licitação, o título (2 a 120 letras) e a data do prazo.</Alerta>}
      {ok === "1" && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          Prazo criado.
        </p>
      )}

      {cartoes.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">
          Para criar prazos, primeiro acompanhe uma licitação na{" "}
          <Link href="/buscar" className="font-semibold text-accent hover:underline">
            busca
          </Link>
          .
        </p>
      ) : (
        <form action={acaoAdicionarPrazo} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">Novo prazo</h2>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="acompanhamentoId" className="text-sm font-medium text-ink">
              Licitação
            </label>
            <select
              id="acompanhamentoId"
              name="acompanhamentoId"
              required
              className="h-10 w-full rounded-md border border-line-strong bg-bg px-2 text-sm text-ink"
            >
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.objeto.slice(0, 110)}
                </option>
              ))}
            </select>
          </div>
          <CampoTexto
            id="titulo"
            name="titulo"
            rotulo="O que vence"
            placeholder="Pedido de esclarecimento, impugnação, amostra..."
            required
            minLength={2}
            maxLength={120}
          />
          <CampoTexto id="quando" name="quando" type="datetime-local" rotulo="Quando (horário de Brasília)" required />
          <div className="sm:col-span-2">
            <Botao type="submit" icone={Plus}>
              Criar prazo
            </Botao>
          </div>
        </form>
      )}

      {atrasados.length > 0 && (
        <section aria-labelledby="titulo-atrasados" className="flex flex-col gap-2">
          <h2 id="titulo-atrasados" className="text-base font-semibold text-danger">
            Já passaram (últimos 30 dias)
          </h2>
          <ListaPrazos eventos={atrasados.map(paraEvento)} agora={agora} />
        </section>
      )}
      <section aria-labelledby="titulo-proximos" className="flex flex-col gap-2">
        <h2 id="titulo-proximos" className="text-base font-semibold">
          Próximos
        </h2>
        <ListaPrazos eventos={futuros.map(paraEvento)} agora={agora} />
      </section>
    </>
  );
}
