import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, StopCircle } from "lucide-react";
import { acaoParaSessao } from "@/app/acoes-robo-sessao";
import { Botao, Esqueleto, Selo } from "@/components/ui/basicos";
import { obterDb } from "@/lib/dados/db";
import { obterSessaoCompleta, ROTULO_PORTAL, type EstadoSessao } from "@/lib/dados/robo-sessao";
import { exigirOrganizacao } from "@/lib/sessao";
import { MonitorSessao } from "./monitor";

export const metadata: Metadata = { title: "Sessão do robô" };

type Props = { params: Promise<{ id: string }> };

const ROTULO_ESTADO: Record<EstadoSessao, string> = {
  aguardando: "Aguardando",
  conectando: "Conectando",
  em_disputa: "Em disputa",
  encerrado: "Encerrado",
  erro: "Erro",
  parado: "Parado",
};

const TOM_ESTADO: Record<EstadoSessao, "neutro" | "accent" | "sucesso" | "perigo" | "aviso"> = {
  aguardando: "neutro",
  conectando: "accent",
  em_disputa: "accent",
  encerrado: "sucesso",
  erro: "perigo",
  parado: "aviso",
};

export default function PaginaSessao(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <Link href="/robo" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar ao robô de lance
      </Link>
      <Conteudo {...props} />
    </main>
  );
}

async function Conteudo({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const sessao = await obterSessaoCompleta(db, id, organizacaoId);
  if (!sessao) notFound();

  const ativa = sessao.estado === "aguardando" || sessao.estado === "conectando" || sessao.estado === "em_disputa";

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Sessão do robô</h1>
          <Selo tom={TOM_ESTADO[sessao.estado]}>{ROTULO_ESTADO[sessao.estado]}</Selo>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>Portal: <strong className="text-ink">{ROTULO_PORTAL[sessao.portal]}</strong></span>
          <span>Item {sessao.numeroItem}</span>
          <span className="break-all">URL: <code className="text-xs">{sessao.urlDisputa}</code></span>
        </div>
        {sessao.mensagemFinal && (
          <p className={`rounded-md px-3 py-2 text-sm ${sessao.estado === "erro" ? "bg-danger-soft text-danger" : "bg-surface text-muted"}`}>
            {sessao.mensagemFinal}
          </p>
        )}
        {ativa && (
          <form action={acaoParaSessao} className="mt-1">
            <input type="hidden" name="sessaoId" value={sessao.id} />
            <input type="hidden" name="voltar" value={`/robo/sessao/${sessao.id}`} />
            <Botao type="submit" variante="perigo" icone={StopCircle} tamanho="sm">
              Parar robô
            </Botao>
          </form>
        )}
      </header>

      <section aria-labelledby="titulo-log" className="flex flex-col gap-2">
        <h2 id="titulo-log" className="text-base font-semibold">Log em tempo real</h2>
        <MonitorSessao sessaoId={sessao.id} estadoInicial={sessao.estado} />
      </section>
    </>
  );
}
