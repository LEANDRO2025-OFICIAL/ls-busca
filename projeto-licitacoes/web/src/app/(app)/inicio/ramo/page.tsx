import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { acaoSalvarPerfil } from "@/app/acoes";
import { Botao, Esqueleto } from "@/components/ui/basicos";
import { obterDb } from "@/lib/dados/db";
import { listarModalidades, obterPerfil, UFS } from "@/lib/dados/perfil";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Ramo da empresa" };

export default function PaginaRamo() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Ramo da empresa</h1>
        <p className="text-sm text-muted">
          Diga o que sua empresa vende e onde atua. A busca usa isso para mostrar o quanto cada licitação combina com você.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Formulario />
      </Suspense>
    </main>
  );
}

function Grupo({ titulo, dica, children }: { titulo: string; dica: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{titulo}</legend>
      <p className="text-xs text-muted">{dica}</p>
      {children}
    </fieldset>
  );
}

const CAIXA = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface";

async function Formulario() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const [perfil, modalidades] = [await obterPerfil(db, organizacaoId), await listarModalidades(db)];

  return (
    <form action={acaoSalvarPerfil} className="flex flex-col gap-4">
      <Grupo titulo="O que você vende" dica="Um termo por linha. Pode ser palavra ou expressão: “material de limpeza”, “vigilância”, “pneus”.">
        <label htmlFor="termos" className="sr-only">
          Termos do ramo
        </label>
        <textarea
          id="termos"
          name="termos"
          rows={6}
          defaultValue={perfil?.termos.join("\n")}
          placeholder={"material de limpeza\nhigienização\nconservação predial"}
          className="w-full rounded-md border border-line-strong bg-bg p-3 text-sm text-ink placeholder:text-muted"
        />
      </Grupo>

      <Grupo titulo="O que não interessa" dica="Licitações com estes termos ficam fora do “meu ramo” e recebem aderência zero.">
        <label htmlFor="excluidos" className="sr-only">
          Termos excluídos
        </label>
        <textarea
          id="excluidos"
          name="excluidos"
          rows={3}
          defaultValue={perfil?.termosExcluidos.join("\n")}
          placeholder={"hospitalar\nobra"}
          className="w-full rounded-md border border-line-strong bg-bg p-3 text-sm text-ink placeholder:text-muted"
        />
      </Grupo>

      <Grupo titulo="Onde você atende" dica="Deixe tudo desmarcado para considerar o Brasil inteiro.">
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7 md:grid-cols-9">
          {UFS.map((uf) => (
            <label key={uf} className={CAIXA}>
              <input type="checkbox" name="uf" value={uf} defaultChecked={perfil?.ufs.includes(uf)} className="size-4 accent-accent" />
              {uf}
            </label>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Modalidades" dica="Deixe tudo desmarcado para considerar todas. A lista mostra as modalidades que já estão na base.">
        {modalidades.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma modalidade na base ainda. Rode a ingestão do PNCP primeiro.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {modalidades.map((m) => (
              <label key={m.id} className={CAIXA}>
                <input
                  type="checkbox"
                  name="modalidade"
                  value={m.id}
                  defaultChecked={perfil?.modalidades.includes(m.id)}
                  className="size-4 accent-accent"
                />
                {m.nome}
              </label>
            ))}
          </div>
        )}
      </Grupo>

      <div>
        <Botao type="submit" tamanho="lg">
          Salvar e ver licitações do meu ramo
        </Botao>
      </div>
    </form>
  );
}
