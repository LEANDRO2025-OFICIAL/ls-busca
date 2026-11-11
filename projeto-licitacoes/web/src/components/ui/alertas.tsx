import Link from "next/link";
import { Save } from "lucide-react";
import { acaoSalvarBusca } from "@/app/acoes";
import type { AvisoDoBanco, BuscaSalva, TipoAlerta } from "@/lib/dados/alertas";
import { UFS } from "@/lib/dados/perfil";
import { lerFiltros } from "@/lib/filtros-busca";
import { Botao, CampoTexto, Selo } from "./basicos";
import { formatarValor } from "./licitacao";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const seletor = "h-10 w-full rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";

/** Frase curta com os filtros do alerta ("cimento" · MS · a partir de R$ 100.000). */
export function resumoDoAlerta(parametros: Record<string, string>, nomesModalidade: Map<number, string>) {
  const f = lerFiltros(parametros);
  return [
    f.q && `“${f.q}”`,
    f.ramo && "Meu ramo",
    f.uf,
    f.municipio,
    f.modalidade && (nomesModalidade.get(f.modalidade) ?? `Modalidade ${f.modalidade}`),
    f.valorMin != null && `a partir de ${formatarValor(f.valorMin * 100)}`,
    f.valorMax != null && `até ${formatarValor(f.valorMax * 100)}`,
    f.encerra && "encerra em 7 dias",
    f.aderencia && (f.aderencia === 70 ? "aderência alta" : "aderência média ou alta"),
  ].filter(Boolean) as string[];
}

/**
 * Cria ou edita um alerta de busca (com termos) ou um interesse da comunidade (sem termos).
 * Os dois gravam na mesma tabela e passam pelo mesmo casamento na ingestão.
 */
export function FormularioAlerta({
  tipo,
  alerta,
  modalidades,
  rotuloEnviar,
  dicaValorMinimo,
}: {
  tipo: TipoAlerta;
  alerta?: BuscaSalva;
  modalidades: { id: number; nome: string }[];
  rotuloEnviar: string;
  dicaValorMinimo?: string;
}) {
  const p = alerta?.parametros ?? {};
  const s = alerta ? `-${alerta.id}` : "-novo";
  return (
    <form action={acaoSalvarBusca} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="tipo" value={tipo} />
      {alerta && <input type="hidden" name="id" value={alerta.id} />}
      {/* Filtros que só a tela de busca edita continuam valendo depois de editar o alerta. */}
      {(["ramo", "encerra", "ader"] as const).map((c) => p[c] && <input key={c} type="hidden" name={c} value={p[c]} />)}
      <CampoTexto
        id={`nome${s}`}
        name="nome"
        rotulo="Nome"
        defaultValue={alerta?.nome}
        required
        maxLength={120}
        placeholder={tipo === "busca" ? "Ex.: Cimento em MS" : "Ex.: Obras acima de R$ 20 mi no Sul"}
        className={tipo === "busca" ? undefined : "sm:col-span-2"}
      />
      {tipo === "busca" && (
        <CampoTexto
          id={`q${s}`}
          name="q"
          rotulo="Termos"
          defaultValue={p.q}
          maxLength={200}
          placeholder={'cimento -asfalto "material de construção"'}
          dica="Todas as palavras precisam aparecer; use -palavra para excluir."
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`uf${s}`} className="text-sm font-medium text-ink">
          UF
        </label>
        <select id={`uf${s}`} name="uf" defaultValue={p.uf ?? ""} className={seletor}>
          <option value="">Todas</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <CampoTexto id={`mun${s}`} name="mun" rotulo="Município" defaultValue={p.mun} maxLength={80} placeholder="Todos" />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={`mod${s}`} className="text-sm font-medium text-ink">
          Modalidade
        </label>
        <select id={`mod${s}`} name="mod" defaultValue={p.mod ?? ""} className={seletor}>
          <option value="">Todas</option>
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>
      <CampoTexto
        id={`vmin${s}`}
        name="vmin"
        rotulo="Valor mínimo (R$)"
        inputMode="numeric"
        defaultValue={p.vmin}
        placeholder="sem mínimo"
        dica={dicaValorMinimo}
      />
      <CampoTexto id={`vmax${s}`} name="vmax" rotulo="Valor máximo (R$)" inputMode="numeric" defaultValue={p.vmax} placeholder="sem limite" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Botao type="submit" icone={Save}>
          {rotuloEnviar}
        </Botao>
        {alerta && (
          <Link href={tipo === "busca" ? "/alertas" : "/comunidade"} className="text-sm font-semibold text-accent hover:underline">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

/** Histórico de avisos: o que foi avisado, quando e por quê. */
export function ListaAvisos({ avisos, mostrarAlerta = false }: { avisos: AvisoDoBanco[]; mostrarAlerta?: boolean }) {
  if (avisos.length === 0) {
    return <p className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-muted">Nenhum aviso gerado ainda.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-bg">
      {avisos.map((a) => (
        <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <Link href={a.href} className="line-clamp-2 text-sm font-medium text-ink hover:text-accent hover:underline">
              {a.objeto}
            </Link>
            {!a.lido && <Selo tom="accent">Novo</Selo>}
          </div>
          <p className="text-xs text-muted">
            {a.orgao} · {a.municipio ? `${a.municipio}/` : ""}
            {a.uf} · <span className="num">{formatarValor(a.valorCentavos)}</span>
          </p>
          <p className="text-xs text-muted">
            <span className="num">{formatoDataHora.format(a.criadoEm)}</span>
            {mostrarAlerta && ` · ${a.alertaNome}`} · {a.motivo}
            {a.enviadoEm && " · enviado ao webhook"}
          </p>
        </li>
      ))}
    </ul>
  );
}
